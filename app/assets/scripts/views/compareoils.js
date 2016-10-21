/*global Oci */
'use strict';

var d3 = require('d3');
var d3tip = require('d3-tip');
d3tip(d3);
var $ = require('jquery');
import _ from 'lodash';

var utils = require('../utils');

var template = require('../templates/compareoils.ejs');
var blueBar = require('../templates/bluebar.ejs');
var ModelParameters = require('./modelparameters');
var BaseView = require('./baseview');
var OpgeeModel = require('../models/opgee');
var PrelimModel = require('../models/prelim');

var CompareOils = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'click #compare-oils-share': 'handleShare',
    'click #price-button': 'showPrices',
    'change #toggle-lpg': 'handleParametersChange',
    'change .config-dropdown': 'handleDropdown',
    'click .mp-summary': 'handleParametersToggle',
    'change #sort-select': 'handleSortSelect',
    'change #step-select': 'handleStepSelect',
    'change #ratio-select': 'handleRatioSelect',
    'change #region-select': function () { this.handleFilter('region-select', 'Region'); },
    'change #oiltype-select': function () { this.handleFilter('oiltype-select', 'Overall Crude Category'); },
    'change #opec-select': function () { this.handleFilter('opec-select', 'OPEC'); },
    'change #toggle-carbon': 'handleCarbonToggle',
    'keyup #carbon-tax': 'verifyPrice'
  },

  initialize: function () {
    var self = this;
    // set view properties
    this.chartElement = '#compare-oils';
    this.margin = {top: 84, right: 32, bottom: 0, left: 12};
    this.sortOrderDescending = true;
    this.sortStep = 'ghgTotal';
    this.sortRatio = 'perBarrel';
    this.barHeight = 30;
    this.metrics = ['upstream', 'midstream', 'downstream'];
    this.transitionDuration = 1500;
    this.filters = {};
    this.hasShareLinkBeenParsed = false;
    this.showCarbon = false;

    this.shareParams = [
      { name: 'carbonToggle', input: 'toggle-carbon' },
      { name: 'carbonTax', input: 'carbon-tax' },
      { name: 'ratioSelect', input: 'ratio-select' },
      { name: 'stepSelect', input: 'step-select' },
      { name: 'sortSelect', input: 'sort-select' },
      { name: 'regionSelect', input: 'region-select' },
      { name: 'oiltypeSelect', input: 'oiltype-select' },
      { name: 'opecSelect', input: 'opec-select' }
    ];
    // for resizing customization
    this.resizeOptions = { width: true };

    this._windowSizing();

    // Init the tooltip
    this.tip = d3.tip()
      .attr('class', 'd3-tip')
      .html(function (d) {
        var values = self.chartData.map(function (step) {
          var match = _.find(step, function (oil) {
            return oil.y === d.y;
          });
          return {
            name: utils.capitalize(match.step),
            value: match.x,
            units: ''
          };
        });
        // Add total value to tooltip
        values.unshift({
          name: 'Total',
          value: d.ghgTotal,
          units: self.getXAxisSubtitle()
        });
        return utils.createTooltipHtml(d.y, d.type, values, utils.makeId(d.y), '', Oci.data.info[d.y]['Absolute Emissions Icons'], self.showCarbon, false, utils.getDataQuality(d.y).total, self.sortRatio === 'perDollar');
      })
      .offset([0, 20])
      .direction('e');

    this.render();
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));
    this.modelParametersView = new ModelParameters();
    this.$('#model-parameters').html(this.modelParametersView.render());
    this.listenTo(this.modelParametersView, 'sliderUpdate', this.handleParametersChange);
    this.chartInit();
    this._setupShare();
    this._activateSearchBar();

    this._parseURLAndSetState();
    this.handleFilter('region-select', 'Region');
    this.handleFilter('oiltype-select', 'Overall Crude Category');
    this.handleFilter('opec-select', 'OPEC');
    this.handleRatioSelect();
    this.handleStepSelect();
    this.handleSortSelect();
    this.handleCarbonToggle();
    this.verifyPrice();
    this.updateChart(true, true);
    this.hasShareLinkBeenParsed = true;
  },

  createChartData: function () {
    var self = this;
    this.chartData = [];

    // Grab things based on the model we're using
    var params = this.modelParametersView.getModelValues();

    // if we don't have the necessary data, load it
    var opgeeRun = utils.getOPGEEModel(params.solarSteam, params.water, params.flaring);
    var prelimRun = utils.getPRELIMModel(params.refinery, params.lpg);
    if (!Oci.Collections.opgee.get(opgeeRun)) {
      var opgeeModel = new OpgeeModel({ id: opgeeRun });
      opgeeModel.fetch({ async: false, success: function (data) {
        Oci.Collections.opgee.add(data);
      }});
    }

    if (!Oci.Collections.prelim.get(prelimRun)) {
      var prelimModel = new PrelimModel({ id: prelimRun });
      prelimModel.fetch({ async: false, success: function (data) {
        Oci.Collections.prelim.add(data);
      }});
    }

    var modelData = {
      info: Oci.data.info,
      opgee: Oci.Collections.opgee.get(opgeeRun).toJSON(),
      prelim: Oci.Collections.prelim.get(prelimRun).toJSON()
    };

    // Apply filters to the oils
    modelData.info = _.pickBy(modelData.info, function (oil) {
      var passesFilter = true;
      _.forOwn(self.filters, function (value, key) {
        if (value.indexOf(oil[key]) === -1) { passesFilter = false; }
      });
      return passesFilter;
    });
    // Reset chart height accordingly
    this.height = this.barHeight * Object.keys(modelData.info).length;

    // Loop over each oil
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
      upstream = +utils.getValueForRatio(upstream, this.sortRatio, prelim, params.showCoke, info);
      midstream = +utils.getValueForRatio(midstream, this.sortRatio, prelim, params.showCoke, info);
      transport = +utils.getValueForRatio(transport, this.sortRatio, prelim, params.showCoke, info);
      combustion = +utils.getValueForRatio(combustion, this.sortRatio, prelim, params.showCoke, info);

      // Sum up for total
      var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

      // Create oil object
      var obj = {
        'id': utils.makeId(info.Unique),
        'name': utils.prettyOilName(info),
        'apiGravity': +info[utils.getDatasetKey('apiGravity')],
        'oilDepth': +info[utils.getDatasetKey('oilDepth')],
        'ghgTotal': ghgTotal,
        'upstream': upstream,
        'midstream': midstream,
        'downstream': combustion + transport,
        'waterToOilRatio': +opgee[utils.getDatasetKey('waterToOilRatio')],
        'gasToOilRatio': +opgee[utils.getDatasetKey('gasToOilRatio')],
        'type': info['Overall Crude Category'].trim()
      };
      this.chartData.push(obj);
    }

    // Sort it accordingly
    this.sortByField(this.sortStep, this.sortOrderDescending);

    // Gather just the data we need
    this.chartData = this.metrics.map(function (metric) {
      return self.chartData.map(function (d) {
        return {
          x: d.name,
          y: d[metric],
          type: d.type,
          ghgTotal: d.ghgTotal
        };
      });
    });

    // the `order` method allows us to put different "steps" first in the stack
    // https://github.com/mbostock/d3/wiki/Stack-Layout#order
    this.lastStep = 'downstream';
    var stack = d3.layout.stack()
      .order(function (data) {
        switch (self.sortStep) {
          case 'midstream':
            return [1, 0, 2];
          case 'downstream':
            self.lastStep = 'midstream';
            return [2, 0, 1];
          default:
            return d3.range(data.length);
        }
      });

    stack(this.chartData);
    this.chartData = this.chartData.map(function (group, i) {
      return group.map(function (d) {
        // Invert the x and y values, and y0 becomes x0
        // add 'step' based on index
        return { x: d.y, y: d.x, x0: d.y0, step: self.metrics[i],
                  type: d.type, ghgTotal: d.ghgTotal }; });
    });
  },

  sortByField: function (field, descending) {
    // this part is only needed for sorting by 'type'
    var groups = _.groupBy(this.chartData, 'type');
    var groupInfo = [];
    _.each(groups, function (group, key) {
      var obj = {};
      obj.name = key;
      obj.avgGhgTotal = _.map(group, 'ghgTotal').reduce(function (a, b) { return a + b; }) / (group.length);
      groupInfo.push(obj);
    });
    groupInfo.sort(function (a, b) {
      return a.avgGhgTotal - b.avgGhgTotal;
    });
    var groupOrder = groupInfo.map(function (group) { return group.name; });

    // the actual sort
    this.chartData.sort(function (a, b) {
      if (field === 'type') {
        // first sort by index of type (it's sorted by group average ghgTotal) then individual ghgTotal
        // switch sign if descending
        return ((groupOrder.indexOf(a.type) * 1000000 + a.ghgTotal) - (groupOrder.indexOf(b.type) * 1000000 + b.ghgTotal)) * (1 - 2 * Number(descending));
      } else if (field === 'indirect') {
        return ((a.upstream + a.midstream) - (b.upstream + b.midstream)) * (1 - 2 * Number(descending));
      } else {
        // switch sign if descending
        return (a[field] - b[field]) * (1 - 2 * Number(descending));
      }
    });
  },

  createScales: function () {
    var width = this.width;
    var height = this.height;

    var xMax = utils.getGlobalExtent(this.sortRatio, 'max');
    this.xScale = d3.scale.linear()
               .domain([0, xMax])
               .range([0, width])
               .nice();
    var oilNames = this.chartData[0].map(function (d) {
      return d.y;
    });
    this.yScale = d3.scale.ordinal()
               .domain(oilNames)
               .rangeBands([0, height], 0.05, 0.1);

    // The opacity scale for process step
    this.processScale = d3.scale.ordinal()
               .domain(['upstream', 'midstream', 'downstream'])
               .rangePoints([1, 0.4]);
  },

  createData: function (xChange) {
    var self = this;
    // Selection
    var groups = this.svg.selectAll('.step')
          .data(this.chartData);

    // Enter
    groups.enter()
          .append('g')
          .attr('class', function (d, i) { return 'step ' + self.metrics[i]; });

    // Nested Selection
    var container = groups.selectAll('g.rect-container')
      .data(function (d) { return d; }, function (d) { return d.y; });

    // Exit
    container.exit()
      .remove();

    // smaller delay if everything is entering
    var allEntering = container.selectAll('rect').length ? 1 : 20;

    // Update
    container.selectAll('rect').data(function (d) { return [d]; })
      .transition()
      .duration(this.transitionDuration / 2 * xChange)
      .attr('x', function (d) { return self.xScale(d.x0); })
      .attr('width', function (d) { return self.xScale(d.x); })
      .transition()
      .delay(this.transitionDuration / 2 * xChange)
      .duration(this.transitionDuration)
      .attr('y', function (d) { return self.yScale(d.y); })
      .attr('height', function () { return self.yScale.rangeBand(); })
      // to ensure it doesn't get interrupted and set to zero
      .attr('opacity', function (d) { return self.processScale(d.step); });

    container.selectAll('text').transition()
      .duration(this.transitionDuration)
      .delay(this.transitionDuration / 2 * xChange)
      .attr('y', function (d) { return self.yScale(d.y) + 3 + self.barHeight / 2; })
      // to ensure it doesn't get interrupted and dissapear
      .attr('opacity', 1)
      .attr('x', 9)
      .attr('fill', '#ccc7c2')
      .text(function (d) { return d.y; });

    var containerEnter = container.enter().append('g').attr('class', 'rect-container');

    containerEnter.append('rect')
      .attr('x', function (d) { return self.xScale(d.x0); })
      .attr('y', function (d) { return self.yScale(d.y); })
      .attr('height', function () { return self.yScale.rangeBand(); })
      .attr('width', function (d) { return self.xScale(d.x); })
      .attr('fill', function (d) { return utils.categoryColorForType(d.type); })
      .attr('opacity', 0)
      .attr('class', function (d) { return d.y.replace(/ /g, '-').replace(/['\.]/g, ''); })
      .on('mouseover', function (d) {
        var className = d.y.replace(/ /g, '-').replace(/['\.]/g, '');
        var selectorString = '.' + self.lastStep + ' rect.' + className;
        var lastNode = d3.select(selectorString).node();
        self.tip.show(d, lastNode);
        $('.stats-list dt:contains("' + utils.capitalize(d.step) + '")').addClass('highlight');
        $('.stats-list dt:contains("' + utils.capitalize(d.step) + '")').next().addClass('highlight');
        $('.stats-list dt:contains("Total")').addClass('total');
        $('.stats-list dt:contains("Total")').next().addClass('total');
      })
      .on('mouseleave', function () {
        if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
          $('.d3-tip').on('mouseleave', function () {
            self.tip.hide();
          });
        } else {
          self.tip.hide();
        }
      })
      .transition()
      .delay(this.transitionDuration / allEntering)
      .duration(this.transitionDuration / 2)
      .attr('opacity', function (d) { return self.processScale(d.step); });

    containerEnter.append('text')
      .transition()
      .delay(this.transitionDuration / allEntering)
      .attr('y', function (d) { return self.yScale(d.y) + 4.5 + self.barHeight / 2; })
      .attr('x', 9)
      .attr('fill', '#ccc7c2')
      .text(function (d) { return d.y; });

    if (this.chartData[0].length === 0) {
      $('#no-results-message').show();
    } else {
      $('#no-results-message').hide();
    }
  },

  createAxes: function () {
    var self = this;
    var width = this.width;

    this.xAxis = d3.svg.axis()
              .scale(this.xScale)
              .orient('top');

    this.svg.append('g')
      .attr('class', 'x axis')
      .call(this.xAxis);

    // X axis title
    var g = this.svg.append('g');
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        -68 + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title')
      .text(self.getXAxisTitle());
    g.append('text')
      .attr('transform', 'translate(' + (width / 2) + ',' +
        -48 + ')')
      .style('text-anchor', 'middle')
      .attr('class', 'x axis title subtitle')
      .text(self.getXAxisSubtitle());
  },

  chartInit: function () {
    // For responsiveness
    this.width = $(this.chartElement).width() - this.margin.left - this.margin.right;

    // Create SVG element
    this.svg = d3.select(this.chartElement)
                .append('svg')
                .attr('width', this.width + this.margin.left + this.margin.right)
              .append('g')
                .attr('transform',
                      'translate(' + this.margin.left + ',' + this.margin.top + ')');

    this.svg.call(this.tip);

    var numOils = Object.keys(Oci.data.info).length;

    // Set height
    this.height = this.barHeight * numOils;
    d3.select(this.chartElement + ' svg')
      .attr('height', this.height + this.margin.top + this.margin.bottom);

    this.createChartData();
    this.createScales();
    this.createData(false);
    this.createAxes();
  },

  handleSortSelect: function () {
    this.sortOrderDescending = ($('input[name=sort-select]:checked').val() === 'true');
    this.updateChart(false, false);
  },

  handleStepSelect: function () {
    var options = document.getElementsByName('step-select');
    var step;
    var oldStep = this.sortStep.slice(0);
    for (var i = 0; i < options.length; i++) {
      if (options[i].checked) {
        step = options[i].value;
        this.sortStep = step;
        break;
      }
    }
    // we need to know if we've switched from a "correctly" organized set of
    // steps to an out-of-order one (also between the two odd ones)
    var oddSteps = ['midstream', 'downstream'];
    var xChange = oddSteps.indexOf(oldStep) !== oddSteps.indexOf(this.sortStep);
    this.updateChart(false, xChange);
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
    this.updateChart(true, true);
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
    this.updateChart(false, false);
  },

  updateChart: function (animate, xChange) {
    this.createChartData();
    this.createScales();
    this.createData(xChange);
    this.updateAxes(animate);
    this._updateCopyLink();
  },

  updateAxes: function (animate) {
    var self = this;

    // extraThousander handles conversion of grams to kgs for certain ratios
    var extraThousander = this.sortRatio === 'perDollar';
    var xMax = utils.getGlobalExtent(this.sortRatio, 'max');
    var axisScale = (this.showCarbon)
    ? d3.scale.linear().domain([0, xMax / (1000 * (extraThousander ? 1000 : 1)) * Oci.carbonTax]).range([0, this.width]).nice()
    : this.xScale;

    this.xAxis = d3.svg.axis().scale(axisScale).orient('top');

    this.svg.select('.x.axis')
      .transition()
      .duration(this.transitionDuration)
      .call(this.xAxis);

    // Update x title with animation if called for
    if (animate) {
      $('.x.axis.title').fadeOut(this.transitionDuration / 2, function () {
        self.svg.select('.x.axis.subtitle').text(self.getXAxisSubtitle());
        self.svg.select('.x.axis.title').text(self.getXAxisTitle());
        $(this).fadeIn(self.transitionDuration / 2);
      });
    }
  },

  handleShare: function (e) {
    e.preventDefault();
  },

  showPrices: function (e) {
    e.preventDefault();
    Oci.showPricesModal(true);
  },

  updatePrices: function () {
    // We have new prices, recreate dataset and update chart
    this.createChartData();
    this.updateChart(false, true);
  },

  getXAxisTitle: function () {
    if (this.showCarbon) {
      return 'Carbon Tax';
    } else {
      return utils.getDatasetName(this.sortStep, this.sortRatio);
    }
  },

  getXAxisSubtitle: function () {
    if (this.showCarbon) {
      return utils.getUnits('ghgTotal', this.sortRatio)
        .replace(/.*\//, '$ tax/').replace('MJ', '1000 MJ');
    } else {
      return utils.getUnits('ghgTotal', this.sortRatio);
    }
  },

  handleDropdown: function () {
    $('.config-dropdown').blur();
    this.handleParametersChange();
  },

  handleParametersChange: function () {
    this.createChartData();
    this.updateChart(false, true);
    this._updateCopyLink();
  },

  handleParametersToggle: function () {
    $('#model-parameters').toggleClass('open');
  },

  verifyPrice: function () {
    var input = $('#carbon-tax');
    var valid = /^\d{0,7}(\.\d{0,2})?$/.test(input.val());

    if (!valid) {
      var newValue = input.val();
      newValue = newValue.replace(/[^\d.]/g, '');
      newValue = parseFloat(newValue).toFixed(2);
      // Take care of NaN case or too many numbers case
      if (isNaN(newValue) || newValue.length >= 11) {
        newValue = parseFloat(20).toFixed(2);
      }

      input.val(newValue);
    }
    Oci.carbonTax = input.val();
    this.updateAxes(false);
    this._updateCopyLink();
  },

  handleCarbonToggle: function () {
    this.showCarbon = $('#toggle-carbon').is(':checked');
    if (this.showCarbon) {
      $('#toggle-carbon').parent().parent().find('.input-group').removeClass('disabled');
    } else {
      $('#toggle-carbon').parent().parent().find('.input-group').addClass('disabled');
    }
    this.updateAxes(true);
    this._updateCopyLink();
  }
});

module.exports = CompareOils;
