/*global Oci */
'use strict';
var $ = require('jquery');
import _ from 'lodash';
var d3 = require('d3');
var d3tip = require('d3-tip');
d3tip(d3);

var utils = require('../utils');

var template = require('../templates/supplycurve.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var SupplyCurve = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'click .share': 'handleShare',
    'click .button-filter, .header-filter': 'handleFilterHide',
    'click': 'hideFilterIfClickOutside',
    'click #ratio-select': 'handleRatioSelect',
    'change #region-select': function () { this.handleFilter('region-select', 'Region'); },
    'change #oiltype-select': function () { this.handleFilter('oiltype-select', 'Overall Crude Category'); }
  },

  initialize: function () {
    var self = this;

    this.chartElement = '#supply-curve';
    this.margin = {top: 38, right: 8, bottom: 72, left: 84};
    this.aspectRatio = 2.5;
    this.minProductionDisplayWidth = 60000;
    this.transitionDuration = 1000;
    this.filters = {};
    this.hasShareLinkBeenParsed = false;
    this.yProperty = 'perBarrel';

    this.shareParams = [
      { name: 'ratioSelect', input: 'ratio-select' },
      { name: 'regionSelect', input: 'region-select' },
      { name: 'oiltypeSelect', input: 'oiltype-select' }
    ];

    // Init the tooltip
    this.tip = d3.tip()
      .attr('class', 'd3-tip')
      .html(function (d) {
        var ghgTotal = utils.numberWithCommas(d.ghgTotal);
        var ghgPerMJ = utils.numberWithCommas(d.ghgPerMJ);
        var productionVolume = utils.numberWithCommas(d.productionVolume);
        var total = utils.numberWithCommas(d.ghgTotal * d.productionVolume * 365 / (1000 * 1000000));

        var yValue;
        if (self.yProperty === 'perBarrel') {
          yValue = ghgTotal;
        } else {
          yValue = ghgPerMJ;
        }

        var values = [
          {
            name: 'GHG Emissions',
            value: yValue,
            units: utils.getUnits('ghgTotal', self.yProperty)
          },
          {
            name: 'Current Production',
            value: productionVolume,
            units: utils.getUnits('productionVolume')
          },
          {
            name: 'Estimated GHG Emission Rate',
            value: total,
            units: utils.getUnits('emissionRate')
          }
        ];

        var description = '';
        return utils.createTooltipHtml(d.name, d.type, values, d.id, description, Oci.data.info[d.name]['Absolute Emissions Icons'], false, false, utils.getDataQuality(d.name).total);
      })
      .offset(function (d) {
        // things too far right have to point a different direction (see below)
        if (self.xScale(d.x0) < self.width * 0.9) {
          var yVar = (self.yProperty === 'perBarrel')
          ? 'ghgTotal'
          : 'ghgPerMJ';
          return [-self.yScale(d[yVar]) + (self.height - 100), 0];
        } else {
          return [0, -5];
        }
      }).direction(function (d) {
        return (self.xScale(d.x0) < self.width * 0.9) ? 'n' : 'w';
      });

    this.render();
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));

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
    this.handleFilter('region-select', 'Region');
    this.handleFilter('oiltype-select', 'Overall Crude Category');
    this.hasShareLinkBeenParsed = true;
  },

  formatStackedData: function () {
    var self = this;

    var yVar;
    if (self.yProperty === 'perBarrel') {
      yVar = 'ghgTotal';
    } else {
      yVar = 'ghgPerMJ';
    }

    this.stackedTotal = 0;
    this.dataset.sort(function (a, b) {
      return a[yVar] - b[yVar];
    });

    // Build a kind of stacked map data structure, also applying a min width
    this.dataset.map(function (oil, index, oils) {
      // Set a min display width
      oil.plotProductionVolume = oil.productionVolume < self.minProductionDisplayWidth
      ? self.minProductionDisplayWidth
      : oil.productionVolume;

      // Set a x0 value for stackedness
      if (index === 0) {
        oil.x0 = 0;
      } else {
        oil.x0 = oils[index - 1].x0 + oils[index - 1].plotProductionVolume;
      }

      // Keep track of total for x axis
      self.stackedTotal += oils[index].plotProductionVolume;
    });
  },

  buildDataset: function (data) {
    var arr = [];
    this.yMax = 0;

    var oils = Object.keys(data.info);
    for (var i = 0; i < oils.length; i++) {
      var oilInfo = data.info[oils[i]];
      var ghgTotal = +oilInfo['Total Emissions'];
      var prelim = Oci.Collections.prelim.get('run01').toJSON()[oils[i]];

      // 0 refers to no petroleum coke
      var ghgPerMJ = utils.getValueForRatio(ghgTotal, 'perMJ', prelim, 0, oilInfo);

      var obj = {
        'id': utils.makeId(oilInfo.Unique),
        'name': utils.prettyOilName(oilInfo),
        'productionVolume': +oilInfo['Oil Production Volume'],
        'ghgTotal': ghgTotal,
        'ghgPerMJ': ghgPerMJ,
        'type': oilInfo['Overall Crude Category'].trim(),
        'category': oilInfo['Sulfur Category'],
        'productionVolumeCategory': oilInfo['Production Volume'],
        'country': oilInfo.Country,
        'onshore': oilInfo['Onshore/Offshore']
      };

      // Need to find the maximum before the data is filtered
      var yVar;
      if (this.yProperty === 'perBarrel') {
        yVar = 'ghgTotal';
      } else {
        yVar = 'ghgPerMJ';
      }
      this.yMax = Math.max(this.yMax, obj[yVar]);

      var passesFilter = true;
      _.forOwn(this.filters, function (value, key) {
        if (value.indexOf(oilInfo[key]) === -1) { passesFilter = false; }
      });
      if (passesFilter) { arr.push(obj); }
    }

    return arr;
  },

  createScales: function (axis) {
    if (axis === 'x' || typeof axis === 'undefined') {
      this.xScale = d3.scale.linear()
                      .domain([0, this.stackedTotal])
                      .range([0, this.width]);
    }

    if (axis === 'y' || typeof axis === 'undefined') {
      this.yScale = d3.scale.linear()
                      .domain([0, this.yMax])
                      .range([this.height, 0])
                      .nice();
    }
  },

  createAxes: function () {
    // Define X axis
    this.xAxis = d3.svg.axis()
              .scale(this.xScale)
              .orient('bottom')
              .ticks(10)
              .tickFormat(function (d) { return d / 1000000; });

    // Define Y axis
    this.yAxis = d3.svg.axis()
              .scale(this.yScale)
              .orient('left')
              .ticks(5);

    // Create Y axis
    this.svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(0,0)')
      .call(this.yAxis);

    // Create X axis
    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (this.height + 4) + ')')
      .call(this.xAxis);

    // X axis title
    var g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'translate(' + (this.width / 2) + ',' +
        (this.height + this.margin.bottom - 25) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title')
      .text(utils.getDatasetName('productionVolume'));
    g.append('text')
      .attr('transform', 'translate(' + (this.width / 2) + ',' +
        (this.height + this.margin.bottom - 5) + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title subtitle')
      .text('Million barrels per day');

    // Y axis title
    g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -this.margin.left)
      .attr('x', -(this.height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title')
      .text(utils.getDatasetName('ghgTotal', this.yProperty));
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -this.margin.left + 20)
      .attr('x', -(this.height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'y axis title subtitle')
      .text(utils.getUnits('ghgTotal', this.yProperty));

    // Graph title
    this.svg.append('text')
    .attr('y', -20)
    .attr('x', this.width / 2)
    .style('text-anchor', 'middle')
    .attr('class', 'title main-title')
    .text('Total Estimated GHG Emissions and Production Volumes for 75 OCI Test Oils');
  },

  updateAxes: function (axis) {
    var self = this;

    this[axis + 'Axis'].scale(this[axis + 'Scale']);
    this.svg.select('.' + axis + '.axis')
      .transition()
      .duration(this.transitionDuration)
      .call(this[axis + 'Axis']);

    if (axis === 'y') {
      $('.y.axis.title').fadeOut(this.transitionDuration / 2, function () {
        self.svg.select('.y.axis.title').text(utils.getDatasetName('ghgTotal', self.yProperty));
        self.svg.select('.y.axis.title.subtitle').text(utils.getUnits('ghgTotal', self.yProperty));
        $(this).fadeIn(self.transitionDuration / 2);
      });
    }
  },

  createData: function () {
    var self = this;

    var yVar;
    if (this.yProperty === 'perBarrel') {
      yVar = 'ghgTotal';
    } else {
      yVar = 'ghgPerMJ';
    }

    var selection = this.svg.selectAll('rect')
       .data(this.dataset, function (oil) { return oil.name; });

    // Exit
    selection.exit()
      .transition()
      .duration(this.transitionDuration / 2)
      .attr('opacity', 0)
      .remove();

    // Update
    selection
      .transition()
      .duration(this.transitionDuration)
      .attr('x', function (d) { return self.xScale(d.x0); })
      .attr('y', function (d) { return self.yScale(d[yVar]); })
      .attr('height', function (d) { return self.height - self.yScale(d[yVar]); })
      .attr('width', function (d) { return self.xScale(d.plotProductionVolume); })
      .attr('opacity', 0.8);

    // Enter
    selection.enter()
       .append('rect')
       .attr('x', function (d) { return self.xScale(d.x0); })
       .attr('y', function (d) { return self.yScale(d[yVar]); })
       .attr('height', function (d) { return self.height - self.yScale(d[yVar]); })
       .attr('width', function (d) { return self.xScale(d.plotProductionVolume); })
       .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
       .attr('opacity', 0)
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
       .duration(this.transitionDuration / 2)
       .delay(this.transitionDuration / 2)
       .attr('opacity', 0.8);

    if (this.dataset.length === 0) {
      $('#no-results-message').show();
    } else {
      $('#no-results-message').hide();
    }
  },

  chartInit: function () {
    var margin = this.margin;
    var width = this.width;
    var height = this.height;

    // Create SVG element
    this.svg = d3.select('#supply-curve')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    this.svg.call(this.tip);

    this.dataset = this.buildDataset(Oci.data);
    this.formatStackedData();
    this.createScales();
    this.createAxes();
    this.createData();
  },

  updateChart: function (axis) {
    this.dataset = this.buildDataset(Oci.data);
    this.formatStackedData();
    this.createScales(axis);
    this.updateAxes(axis);
    this.createData();
    this._updateCopyLink();
  },

  handleShare: function (e) {
    e.preventDefault();
  },

  handleRatioSelect: function () {
    var options = document.getElementsByName('ratio-select');
    var ratio;
    for (var i = 0; i < options.length; i++) {
      if (options[i].checked) {
        ratio = options[i].value;
        this.yProperty = ratio;
        break;
      }
    }
    this.updateChart('y');
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
    this.updateChart('x');
  },

  handleFilterHide: function () {
    $('.filter-hideable').toggleClass('filter-hidden');
  },

  hideFilterIfClickOutside: function (e) {
    if (
      $(e.target).closest('.filter-hideable').length === 0 &&
      !$(e.target).is('.button-filter')
    ) {
      $('.filter-hideable').addClass('filter-hidden');
    }
  }
});

module.exports = SupplyCurve;
