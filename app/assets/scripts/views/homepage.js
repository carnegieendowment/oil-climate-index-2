'use strict';

var $ = require('jquery');
var d3 = require('d3');
require('d3-tip');
var _ = require('lodash');

var utils = require('../utils');
var mockData = require('../animation-mock-data');
var template = require('../templates/homepage.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var HomePageChart = function () {};
HomePageChart.prototype.init = function (el) {
  this.el = el;
  this.animated = false;
  this.width = $(this.el).width();
  this.height = 250;
  this.create();
};
HomePageChart.prototype.create = function () {
  this.createDataAndScales();
  d3.select(this.el).selectAll('*').remove();
  this.svg = d3.select(this.el).append('svg')
    .attr('width', this.width)
    .attr('height', this.height);

  this.draw();
  return this;
};

var HomePage = BaseView.extend({

  template: template,

  el: '.content',

  events: {},

  initialize: function () {
    var self = this;

    this._windowSizing();
    // only used for sharing in this case
    this.chartElement = '#home';

    this.charts = {};

    // map preview
    this.charts.fakeMap = new HomePageChart();
    this.charts.fakeMap.createDataAndScales = function () {
      // override height
      this.height = 387;
      this.data = mockData.map;

      this.colorScale = d3.scale.linear()
                          .domain(d3.extent(_.map(this.data, 'g')))
                          .range(['#ddd', 'orangered']);
    };
    this.charts.fakeMap.draw = function () {
      // use mapbox static api to fill in the background
      var token = 'pk.eyJ1IjoiZGV2c2VlZCIsImEiOiJnUi1mbkVvIn0.018aLhX0Mb0tdtaT2QNe2Q';
      var url = 'https://api.mapbox.com/v4/devseed.f5a0e5c3/0,20,2/' +
        this.width + 'x' + this.height + '.png?access_token=' + token;
      $(this.el).css('background-image', 'url(' + url + ')');

      var graph = this;
      // Selection
      var circles = this.svg.selectAll('circle')
         .data(this.data);

      // Enter
      circles.enter()
         .append('circle')
         .attr('fill', function (d) { return graph.colorScale(d.g); })
         .attr('opacity', 0.5)
         .attr('cx', function (d) { return d.x * graph.width; })
         .attr('cy', function (d) { return d.y * graph.height; })
         .attr('r', 0);
    };
    this.charts.fakeMap.animate = function () {
      // Update
      var circles = this.svg.selectAll('circle')
         .data(this.data);

      var duration = 1000;
      circles.transition()
          .delay(function (d, i) { return i * 75; })
          .duration(duration)
          .attr('r', function (d) { return d.r * 2.2; });
    };

    // production graph
    this.charts.fakeProductionGraph = new HomePageChart();
    this.charts.fakeProductionGraph.createDataAndScales = function () {
      var stackedTotal = 0;
      this.data = mockData.productionGraph;
      this.data.forEach(function (d) {
        d.x0 = stackedTotal;
        stackedTotal += d.p;
      });
      this.x = d3.scale.linear()
          .domain([0, stackedTotal])
          .range([0, this.width]);

      this.y = d3.scale.linear()
          .domain([0, d3.max(this.data, function (d) { return d.g; })])
          .range([this.height, 0]);
    };
    this.charts.fakeProductionGraph.draw = function () {
      var graph = this;
      this.svg.selectAll('rect')
         .data(this.data)
         .enter()
         .append('rect')
         .attr('x', function (d, i) { return graph.x(i * 12); })
         .attr('y', function (d) { return graph.y(0); })
         .attr('width', function (d) { return graph.x(12); })
         .attr('height', function (d) { return graph.height - graph.y(0); })
         .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
         .attr('opacity', 0.8);
    };
    this.charts.fakeProductionGraph.animate = function () {
      var graph = this;
      var duration = 750;
      var delayStagger = 50;
      this.svg.selectAll('rect')
        .data(this.data)
        .transition()
        .delay(function (d, i) { return i * delayStagger; })
        .duration(duration)
        .attr('y', function (d) { return graph.y(d.g); })
        .attr('height', function (d) { return graph.height - graph.y(d.g); })
        .transition()
        .delay(duration + (graph.data.length - 1) * delayStagger)
        .duration(duration)
        .attr('x', function (d) { return graph.x(d.x0); })
        .attr('width', function (d) { return graph.x(d.p); });
    };

    // supply chain
    this.charts.fakeSupplyChain = new HomePageChart();
    this.charts.fakeSupplyChain.createDataAndScales = function () {
      var graph = this;
      this.metrics = ['upstream', 'midstream', 'downstream'];

      this.data = mockData.supplyChain;
      var stack = d3.layout.stack();
      stack(this.data);
      this.data = this.data.map(function (group, i) {
        return group.map(function (d) {
          // Invert the x and y values, and y0 becomes x0
          // add 'step' based on index
          return { x: d.y, y: d.x, x0: d.y0, step: graph.metrics[i],
                    type: d.type, ghgTotal: d.g }; });
      });

      this.tip = d3.tip()
        .attr('class', 'd3-tip')
        .html(function () {
          var d = graph.data;
          var values = [
            { name: 'Upstream', value: d[0][1].x, units: '' },
            { name: 'Midstream', value: d[1][1].x, units: '' },
            { name: 'Downstream', value: d[2][1].x, units: '' }
          ];
          // Add total value to tooltip
          values.unshift({ name: 'Total', value: d[0][1].x + d[1][1].x + d[2][1].x, units: utils.getUnits('ghgTotal', 'perBarrel') });
          // values.unshift({ name: 'Total', value: utils.numberWithCommas(d.ghgTotal, self.sortRatio), units: utils.getUnits('ghgTotal', self.sortRatio) });
          return utils.createTooltipHtml('', d[0][1].type, values, '', '');
        })
        .offset([50, 0]);

      this.x = d3.scale.linear()
                 .domain([0, 120])
                 .range([0, this.width])
                 .nice();

      this.y = d3.scale.ordinal()
                 .domain(['oil1', 'oil2', 'oil3', 'oil4', 'oil5', 'oil6', 'oil7', 'oil8'].reverse())
                 .rangeRoundBands([0, this.height], 0.05);

      // The opacity scale for process step
      this.processScale = d3.scale.ordinal()
        .domain(['upstream', 'midstream', 'downstream'])
        .rangePoints([1, 0.4]);
    };
    this.charts.fakeSupplyChain.draw = function () {
      var graph = this;
      var groups = this.svg.selectAll('.step')
           .data(this.data);

      // Enter
      groups.enter()
           .append('g')
           .attr('class', function (d, i) { return 'step ' + graph.metrics[i]; });

      // Nested Selection
      var container = groups.selectAll('g.rect-container')
       .data(function (d) { return d; }, function (d) { return d.y; });

      var containerEnter = container.enter().append('g').attr('class', 'rect-container');

      containerEnter.append('rect')
       .attr('x', function (d, i) { return graph.x(0); })
       .attr('y', function (d) { return graph.y(d.y); })
       .attr('height', function () { return graph.y.rangeBand(); })
       .attr('width', function (d) { return graph.x(0); })
       .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
       .attr('opacity', function (d) { return graph.processScale(d.step); });

      this.svg.call(this.tip);
    };
    this.charts.fakeSupplyChain.animate = function () {
      var graph = this;
      var groups = this.svg.selectAll('.step')
           .data(this.data);

      // Enter
      groups.enter()
           .append('g')
           .attr('class', function (d, i) { return 'step ' + graph.metrics[i]; });

      // Nested Selection
      var container = groups.selectAll('g.rect-container')
       .data(function (d) { return d; }, function (d) { return d.y; });
      // Update
      var duration = 750;
      var delayStagger = 5;

      container.selectAll('rect').data(function (d) { return [d]; })
        .transition()
        .delay(function (d) { return graph.y(d.y) * delayStagger; })
        .duration(duration)
        .attr('x', function (d) { return graph.x(d.x0); })
        .attr('width', function (d) { return graph.x(d.x); });

      setTimeout(function () {
        var target = graph.svg.selectAll('.midstream .rect-container')[0][1];
        graph.tip.show('', target);
        $('.popover').addClass('fake');
      }, 2000);
    };

    // oil attributes
    this.charts.fakeOilAttributes = new HomePageChart();
    this.charts.fakeOilAttributes.createDataAndScales = function () {
      // Overwrite variables to add margins
      this.margin = {top: 0, right: 0, bottom: 20, left: 20};
      this.width = this.width - this.margin.left - this.margin.right;
      this.height = this.height - this.margin.top - this.margin.bottom;

      this.data = mockData.oilAttributes;
      // Create scale functions
      var xMax = self.addExtentBuffer(d3.max(this.data, function (d) {
        return d.x;
      }));
      this.x = d3.scale.linear()
                 .domain([0, xMax])
                 .range([0, this.width]);

      var yExtent = self.addExtentBuffer([60, 120]);

      this.y = d3.scale.linear()
                 .domain(yExtent)
                 .range([this.height, 0]);

      var rExtent = self.addExtentBuffer(d3.extent(this.data, function (d) {
        return d.p;
      }));
      this.r = d3.scale.sqrt()
                    .domain(rExtent)
                    .range([4, 42]);
    };
    this.charts.fakeOilAttributes.draw = function () {
      // Overwrite svg
      this.svg = this.svg
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top + this.margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

      var graph = this;
      // Selection
      var circles = this.svg.selectAll('circle')
         .data(this.data);

      // Enter
      circles.enter()
         .append('circle')
         .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
         .attr('opacity', 0.8)
         .attr('cx', function (d) { return graph.x(d.x); })
         .attr('cy', function (d) { return graph.y(d.g); })
         .attr('r', function (d) { return 0; });

      // add axes
      var xAxis = d3.svg.axis()
               .scale(this.x)
               .orient('bottom')
               .ticks(5);

      this.svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + (this.height + 8) + ')')
        .call(xAxis);

      // X axis title
      this.xProperty = 'waterToOilRatio';
      $(this.el).next().html(utils.getDatasetName(this.xProperty));
    };
    this.charts.fakeOilAttributes.animate = function () {
      var graph = this;
      // Update
      var circles = this.svg.selectAll('circle')
         .data(this.data);

      var duration = 750;
      var delay = 1250;
      circles.transition()
          .duration(duration)
          .attr('r', function (d) { return graph.r(d.p); })
          .transition()
          .delay(delay + duration)
          .duration(duration)
          .attr('cx', function (d) { return graph.x(d.xAlt); });

      setTimeout(function () {
        $(graph.el).next().fadeOut(0);
        $(graph.el).next().html(utils.getDatasetName('gasToOilRatio')).fadeIn(duration);
      }, duration + delay);
    };

    // oil details
    this.charts.oilDetails = new HomePageChart();
    this.charts.oilDetails.init = function (el) {
      this.el = el;
      this.animated = false;
    };
    this.charts.oilDetails.create = function () {
      $(this.el).removeClass('shown');
    };
    this.charts.oilDetails.animate = function () {
      $(this.el).addClass('shown');
    };

    this.render();
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));
    this._activateSearchBar();
    this.charts.fakeMap.init('#map-preview');
    this.charts.fakeProductionGraph.init('#production-graph-preview');
    this.charts.fakeSupplyChain.init('#supply-chain-preview');
    this.charts.fakeOilAttributes.init('#oil-attributes-preview');
    this.charts.oilDetails.init('#oil-details');
    this.addScrollListener();
  },

  // overwrite base _handleResize function
  _handleResize: function () {
    var self = this;
    d3.select('.d3-tip').remove();
    Object.keys(this.charts).forEach(function (chart) {
      self.charts[chart].create();
      self.charts[chart].animated = false;
    });
  },

  addExtentBuffer: function (extent) {
    // sometimes only receives a max number and then we shouldn't try to access array elements
    var extentBuffer = 0.1;
    if (typeof extent === 'object') {
      extent[0] = extent[0] * (1 - extentBuffer);
      extent[1] = extent[1] * (1 + extentBuffer);
    } else {
      extent = extent * (1 + extentBuffer);
    }
    return extent;
  },

  addScrollListener: function () {
    $(window).on('scroll.custom', this.handleScroll.bind(this));
  },

  handleScroll: function () {
    var self = this;
    var scrollTop = $(window).scrollTop();
    Object.keys(self.charts).filter(function (key) {
      return !self.charts[key].animated;
    }).forEach(function (key) {
      var topDistance = $(self.charts[key].el).offset().top;
      if ((topDistance - 300) < scrollTop) {
        self.charts[key].animate();
        self.charts[key].animated = true;
      }
    });
  }
});

module.exports = HomePage;
