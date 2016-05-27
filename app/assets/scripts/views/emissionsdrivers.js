/*global Oci */
'use strict';
var d3 = require('d3');
var d3tip = require('d3-tip');
d3tip(d3);
var $ = require('jquery');
var _ = require('lodash');

var utils = require('../utils');
var ss = require('simple-statistics');

var template = require('../templates/emissionsdrivers.ejs');
var blueBar = require('../templates/bluebar.ejs');
var ModelParameters = require('./modelparameters');
var BaseView = require('./baseview');

var EmissionsDrivers = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'click #ratio-select': 'handleRatioSelect',
    'click #emissions-drivers-share': 'handleShare',
    'click': 'hideTip',
    'click #price-button': 'showPrices',
    'change #toggle-lpg': 'handleParametersChange',
    'change .config-dropdown': 'handleDropdown',
    'click .mp-summary': 'handleParametersToggle',
    'change #oiltype-select': function () { this.handleFilter('oiltype-select', 'Overall Crude Category'); }
  },

  hideTip: function () {
    this.tip.hide();
  },

  initialize: function () {
    var self = this;
    // set view properties
    this.chartElement = '#emissions-drivers';
    this.margin = {top: 85, right: 28, bottom: 72, left: 84};
    this.aspectRatio = 1.5;
    this.xProperty = 'upstream';
    this.sortRatio = 'perBarrel';
    this.yProperty = 'ghgTotal';
    this.transitionDuration = 1000;
    this.extentBuffer = 0.1;
    this.filters = {};
    this.hasShareLinkBeenParsed = false;
    // this is used to decide which properties of the internal state should be
    // shared; when the url is parsed, we will also set input fields based on
    // these
    this.shareParams = [
      { name: 'ratioSelect', input: 'ratio-select' },
      { name: 'xSelect', input: 'x-select' },
      { name: 'ySelect', input: 'y-select' },
      { name: 'oiltypeSelect', input: 'oiltype-select' }
    ];

    // add window resizing listeners
    this._windowSizing();

    // tooltip
    this.tip = d3.tip().attr('class', 'd3-tip').html(function (d) {
      var values = [
        {
          name: utils.getDatasetName(self.xProperty),
          value: utils.numberWithCommas(d[self.xProperty]),
          units: utils.getUnits(self.xProperty, self.sortRatio)
        },
        {
          name: utils.getDatasetName(self.yProperty).split(' ').pop(),
          value: utils.numberWithCommas(d[self.yProperty]),
          units: utils.getUnits(self.yProperty, self.sortRatio)
        },
        {
          name: utils.getDatasetName('productionVolume'),
          value: utils.numberWithCommas(d.productionVolume),
          units: utils.getUnits('productionVolume', self.sortRatio)
        }
      ];
      return utils.createTooltipHtml(d.name, d.type, values, d.id, '', Oci.data.info[d.name]['Absolute Emissions Icons'], false, false, utils.getDataQuality(d.name).total);
    }).offset([0, 20]).direction('e');

    this.render();
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));
    this.modelParametersView = new ModelParameters();
    this.$('#model-parameters').html(this.modelParametersView.render());
    this.listenTo(this.modelParametersView, 'sliderUpdate', this.handleParametersChange);

    // For responsiveness
    var margin = this.margin;
    this.width = $(this.chartElement).width() - margin.left - margin.right;
    this.height = Math.round(this.width / this.aspectRatio);

    this.chartInit();
    this._setupShare();
    this._activateSearchBar();

    // If any of the parameters are set in the URL, have to apply those filters
    this._parseURLAndSetState();
    this.handleRatioSelect();
    this.changeAxisCategory('x');
    this.changeAxisCategory('y');
    this.handleFilter('oiltype-select', 'Overall Crude Category');
    this.hasShareLinkBeenParsed = true;
  },

  addExtentBuffer: function (extent) {
    // sometimes only receives a max number and then we shouldn't try to access array elements
    var extentBuffer = this.extentBuffer;
    if (typeof extent === 'object') {
      extent[0] = extent[0] * (1 - extentBuffer);
      extent[1] = extent[1] * (1 + extentBuffer);
    } else {
      extent = extent * (1 + extentBuffer);
    }
    return extent;
  },

  createScales: function () {
    var self = this;
    // Create scale functions
    var xMax = this.addExtentBuffer(d3.max(this.chartData, function (d) {
      return d[self.xProperty];
    }));
    this.xScale = d3.scale.linear()
               .domain([0, xMax])
               .range([0, this.width])
               .nice();

    var yMin = utils.getGlobalExtent(this.sortRatio, 'min', this.yProperty);
    var yMax = utils.getGlobalExtent(this.sortRatio, 'max', this.yProperty);
    var yExtent = this.addExtentBuffer([yMin, yMax]);

    this.yScale = d3.scale.linear()
               .domain(yExtent)
               .range([this.height, 0])
               .nice();

    var rExtent = this.addExtentBuffer(d3.extent(this.chartData, function (d) {
      return d.productionVolume;
    }));
    this.rScale = d3.scale.sqrt()
                  .domain(rExtent)
                  .range([4, 42]);
  },

  createAxes: function () {
    var margin = this.margin;
    var height = this.height;
    var width = this.width;
    // Define X axis
    this.xAxis = d3.svg.axis()
              .scale(this.xScale)
              .orient('bottom')
              .ticks(5);

    // Define Y axis
    this.yAxis = d3.svg.axis()
              .scale(this.yScale)
              .orient('left')
              .ticks(5);

    // Create X axis
    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (height + 4) + ')')
      .call(this.xAxis);

    // X axis title
    var g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        (height + margin.bottom - 25) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title')
      .text(utils.getDatasetName(this.xProperty));
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        (height + margin.bottom - 5) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title subtitle')
      .text(utils.getUnits(this.xProperty, this.sortRatio));

    // Create Y axis
    this.svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(' + (-4) + ',0)')
      .call(this.yAxis);

    // Y axis title
    g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left)
      .attr('x', -(height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title')
      .text(utils.getDatasetName(this.yProperty, this.sortRatio, true));
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 20)
      .attr('x', -(height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title subtitle')
      .text(utils.getUnits(this.yProperty, this.sortRatio));
  },

  createData: function () {
    var self = this;

    // Selection
    var circles = this.svg.selectAll('circle')
       .data(this.chartData, function (oil) { return oil.name; });

    // Update
    circles.transition()
        .duration(this.transitionDuration)
        .attr('cx', function (d) { return self.xScale(d[self.xProperty]); })
        .attr('cy', function (d) { return self.yScale(d[self.yProperty]); })
        .attr('opacity', 0.8);

    // Enter
    circles.enter()
       .append('circle')
       .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
       .attr('opacity', 0)
       .attr('cx', function (d) { return self.xScale(d[self.xProperty]); })
       .attr('cy', function (d) { return self.yScale(d[self.yProperty]); })
       .attr('r', function (d) { return self.rScale(d.productionVolume); })
       .attr('clip-path', 'url(#chart-area)')
       .on('mouseover', function (d) { self.tip.show(d); })
       .on('mouseout', function () {
         if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
           $('.d3-tip').on('mouseleave', function () {
             self.tip.hide();
           });
         } else {
           self.tip.hide();
         }
       })
       .transition()
       .duration(this.transitionDuration)
       .attr('opacity', 0.8);

    // Exit
    circles.exit()
        .transition()
        .duration(this.transitionDuration)
        .attr('opacity', 0)
        .remove();
  },

  createLegend: function () {
    var margin = this.margin;
    var width = this.width;
    var self = this;

    // The circle legend
    // these purposefully reference the main svg (d3.select('svg')) rather
    // than the <g> (this.svg) so they are written in relation to the non-margin
    // portion
    d3.select('svg').selectAll('.circle-legend')
       .data([55, 68, 86])
       .enter()
       .append('circle')
       .classed('circle-legend', true)
       .attr('fill-opacity', '0')
       .attr('stroke', '#777')
       .attr('cx', function (d) {
         return width + margin.left + margin.right - 57;
       })
       .attr('cy', function (d) { return d; })
       .attr('r', function (d, i) {
         return self.rScale([5000000, 2000000, 100000][i]);
       });

    d3.select('svg').selectAll('.circle-text')
      .data([{text: '5M', y: 10}, {text: '2M', y: 38}, {text: '100k', y: 73}])
      .enter()
      .append('text')
      .attr('class', 'circle-text')
      .attr('x', function (d) { return width + margin.left + margin.right - 57; })
      .attr('y', function (d) { return d.y; })
      .attr('text-anchor', 'middle')
      .style('fill', '#777')
      .text(function (d) { return d.text; });

    d3.select('svg').append('text')
      .attr('x', function (d) { return width + margin.left + margin.right - 105; })
      .attr('y', 12)
      .attr('text-anchor', 'end')
      .attr('class', 'circle-text')
      .style('fill', '#777')
      .text('Production Volume');

    d3.select('svg').append('text')
      .attr('x', function (d) { return width + margin.left + margin.right - 105; })
      .attr('y', 27)
      .attr('text-anchor', 'end')
      .attr('class', 'circle-text')
      .style('fill', '#777')
      .text('Barrels per Day');
  },

  createLine: function () {
    // map our data to the style needed for simple-statistics
    // also apply our scaling
    var self = this;
    var mapped = this.chartData.map(function (obj) {
      return [self.xScale(obj[self.xProperty]), self.yScale(obj[self.yProperty])];
    });

    // If all X values are the same, then can't calculate a line
    var xMin = d3.min(this.chartData, function (d) { return d[self.xProperty]; });
    var xMax = d3.max(this.chartData, function (d) { return d[self.xProperty]; });
    if (xMin === xMax) {
      return this.svg.selectAll('.trend')
        .transition()
        .duration(this.transitionDuration)
        .attr('opacity', 0)
        .remove();
    }

    var linearRegression = ss.linearRegressionLine(ss.linearRegression(mapped));

    var rSquared = ss.rSquared(mapped, linearRegression);

    this.line = d3.svg.line()
           .x(function (d) { return d; })
           .y(function (d) { return linearRegression(d); });

    // Selection
    var trendLine = this.svg.selectAll('.trend')
       .data([[]]);

    // Enter
    trendLine.enter()
       .append('path')
       .attr('clip-path', 'url(#chart-area)')
       .attr('d', this.line(this.xScale.range()))
       .attr('class', 'trend')
       .attr('opacity', Math.min(rSquared + 0.2, 1));

    // Update
    trendLine.transition()
       .duration(this.transitionDuration)
       .attr('d', this.line(this.xScale.range()))
       .attr('opacity', Math.min(rSquared + 0.2, 1));
  },

  chartInit: function () {
    var margin = this.margin;
    var width = this.width;
    var height = this.height;
    // Create SVG element
    this.svg = d3.select(this.chartElement)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    // Invoke the tooltip
    this.svg.call(this.tip);

    // Define clipping path
    this.svg.append('clipPath')             // Make a new clipPath
        .attr('id', 'chart-area')           // Assign an ID
        .append('rect')                     // Within the clipPath, create a new rect
        .attr('width', width)
        .attr('height', height);

    this.createChartData();
    this.createScales();
    this.createAxes();
    this.createLine();
    this.createData();
    this.createLegend();
  },

  // Will generate chart data for current model and ratio
  createChartData: function () {
    var self = this;
    this.chartData = [];

    // Grab things based on the model we're using
    var params = this.modelParametersView.getModelValues();

    var modelData = {
      info: Oci.data.info,
      opgee: Oci.data.opgee[utils.getOPGEEModel(params.solarSteam, params.water, params.flaring)],
      prelim: Oci.data.prelim[utils.getPRELIMModel(params.refinery, params.lpg)]
    };

    // Apply filters to the oils
    modelData.info = _.pickBy(modelData.info, function (oil) {
      var passesFilter = true;
      _.forOwn(self.filters, function (value, key) {
        if (value.indexOf(oil[key]) === -1) { passesFilter = false; }
      });
      return passesFilter;
    });

    var oils = Object.keys(modelData.info);
    for (var i = 0; i < oils.length; i++) {
      // Get basic properties from model data
      var info = modelData.info[oils[i]];
      var opgee = modelData.opgee[oils[i]];
      var prelim = modelData.prelim[oils[i]];
      // we might not have a prelim run for this oil (certain oils don't
      // run through some refineries)
      if (!prelim) continue;
      var upstream = +opgee['Net lifecycle emissions'];
      var midstream = utils.getRefiningTotal(prelim);
      var transport = +info[utils.getDatasetKey('transport')];
      var combustion = utils.getCombustionTotal(prelim, params.showCoke);

      // Adjust for any ratio
      upstream = +utils.getValueForRatio(upstream, this.sortRatio, prelim, params.showCoke, info, params.lpg);
      midstream = +utils.getValueForRatio(midstream, this.sortRatio, prelim, params.showCoke, info, params.lpg);
      transport = +utils.getValueForRatio(transport, this.sortRatio, prelim, params.showCoke, info, params.lpg);
      combustion = +utils.getValueForRatio(combustion, this.sortRatio, prelim, params.showCoke, info, params.lpg);

      // Sum up for total
      var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

      // Create oil object
      var obj = {
        id: utils.makeId(info.Unique),
        name: utils.prettyOilName(info),
        type: info['Overall Crude Category'].trim(),
        ghgTotal: ghgTotal,
        productionVolume: +info[utils.getDatasetKey('productionVolume')],

        apiGravity: +info[utils.getDatasetKey('apiGravity')],
        sulfurContent: +info[utils.getDatasetKey('sulfurContent')] * 100,
        yearsProduction: +info[utils.getDatasetKey('yearsProduction')],

        upstream: upstream,
        midstream: midstream,
        downstream: combustion + transport,

        waterToOilRatio: +opgee[utils.getDatasetKey('waterToOilRatio')],
        gasToOilRatio: +opgee[utils.getDatasetKey('gasToOilRatio')],
        steamToOilRatio: +opgee[utils.getDatasetKey('steamToOilRatio')],
        flaringToOilRatio: +opgee[utils.getDatasetKey('flaringToOilRatio')],

        prodGasoline: +prelim[utils.getDatasetKey('prodGasoline')],
        prodDiesel: +prelim[utils.getDatasetKey('prodDiesel')],
        prodResidual: +prelim[utils.getDatasetKey('prodResidual')],
        prodLPG: +prelim[utils.getDatasetKey('prodLPG')] * params.lpg,
        prodJet: +prelim[utils.getDatasetKey('prodJet')],
        prodPetcoke: (+prelim[utils.getDatasetKey('prodPetcoke')] + Number(info[utils.getDatasetKey('prodUpstreamPetcoke')])) * params.showCoke,
        currentMarketValue: +info['Per $ Crude Oil - Current'],
        historicMarketValue: +info['Per $ Crude Oil - Historic']
      };

      this.chartData.push(obj);
    }

    // Also filter out X axis values that are `NaN`s
    this.chartData = this.chartData.filter(function (oil) {
      var xIsNull = isNaN(oil[self.xProperty]);
      var yIsNull = isNaN(oil[self.yProperty]);

      if (xIsNull || yIsNull) {
        return false;
      } else {
        return true;
      }
    });

    // Sort chart data so that higher production volume is last
    this.chartData.sort(function (a, b) {
      return b.productionVolume - a.productionVolume;
    });
  },

  changeAxisCategory: function (axis) {
    this[axis + 'Property'] = $('#' + axis + '-select').val();
    this.updateChart(axis);
  },

  handleRatioSelect: function () {
    var options = document.getElementsByName('ratio-select');
    var ratio;
    for (var i = 0; i < options.length; i++) {
      if (options[i].checked) {
        ratio = options[i].value;
        this.sortRatio = ratio;
        break;
      }
    }
    this.createChartData();
    this.updateChart('y');
  },

  updateAxes: function (changedAxis) {
    var self = this;
    var transitionDuration = this.transitionDuration;
    if (!changedAxis || changedAxis === 'x') {
      // Update x-axis
      this.xAxis = d3.svg.axis()
        .scale(this.xScale)
        .orient('bottom')
        .ticks(5);
      this.svg.select('.x.axis')
        .transition()
        .duration(transitionDuration)
        .call(this.xAxis);

      // Update x title
      $('.x.axis.title').fadeOut(transitionDuration / 2, function () {
        self.svg.select('.x.axis.subtitle').text(utils.getUnits(self.xProperty, self.sortRatio));
        self.svg.select('.x.axis.title').text(utils.getDatasetName(self.xProperty, self.sortRatio, true));
        $(this).fadeIn(transitionDuration / 2);
      });
    }

    if (!changedAxis || changedAxis === 'y') {
      // Update y-axis
      this.yAxis = d3.svg.axis()
        .scale(this.yScale)
        .orient('left')
        .ticks(5);
      this.svg.select('.y.axis')
        .transition()
        .duration(transitionDuration)
        .call(this.yAxis);

      // Update y title
      $('.y.axis.title').fadeOut(transitionDuration / 2, function () {
        self.svg.select('.y.axis.subtitle').text(utils.getUnits(self.yProperty, self.sortRatio));
        self.svg.select('.y.axis.title').text(utils.getDatasetName(self.yProperty, self.sortRatio, true));
        $(this).fadeIn(transitionDuration / 2);
      });
    }
  },

  handleShare: function (e) {
    e.preventDefault();
  },

  updateChart: function (changedAxis) {
    this.createChartData();
    this.createScales();
    this.updateAxes(changedAxis);
    this.createLine();
    this.createData();
    this._updateCopyLink();
  },

  handleFilter: function (elementName, propertyName) {
    var options = document.getElementsByName(elementName);
    var checked = [];
    for (var i = 0; i < options.length; i++) {
      var option = options[i];
      if (option.checked) { checked.push(option.value); }
    }

    if (checked.length === 0) {
      delete this.filters[propertyName];
    } else {
      this.filters[propertyName] = checked;
    }
    this.updateChart();
  },

  showPrices: function (e) {
    e.preventDefault();
    Oci.showPricesModal(true);
  },

  updatePrices: function () {
    // We have new prices, recreate chartData and update chart
    this.updateChart('y');
  },

  handleDropdown: function (e) {
    if (e.target.id === 'x-select') { return this.changeAxisCategory('x'); }
    if (e.target.id === 'y-select') { return this.changeAxisCategory('y'); }
    $('.config-dropdown').blur();
    this.handleParametersChange();
  },

  handleParametersChange: function () {
    this.updateChart();
  },

  handleParametersToggle: function () {
    $('#model-parameters').toggleClass('open');
  }
});

module.exports = EmissionsDrivers;
