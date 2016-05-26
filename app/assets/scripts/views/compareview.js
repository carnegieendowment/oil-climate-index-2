/*global Oci, L */
'use strict';
require('mapbox.js');
var d3 = require('d3');
var $ = require('jquery');
var _ = require('lodash');
var turfCentroid = require('turf-centroid');

var utils = require('../utils');
var template = require('../templates/compareview.ejs');
var ModelParameters = require('./modelparameters');
var BaseView = require('./baseview');

var CompareView = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'change #toggle-lpg': 'handleParametersChange',
    'change .config-dropdown': 'handleDropdown',
    'click #oil-details-share': 'handleShare',
    'click .carosel-arrow': 'handleCarosel',
    'click .compare': 'openCompare'
  },

  initialize: function (options) {
    var self = this;
    this.margin = {top: 0, right: 60, bottom: 0, left: 0};
    this.height = 75 - this.margin.top - this.margin.bottom;
    this.barBuffer = 2;
    this.hasShareLinkBeenParsed = false;

    // only used for sharing in this case
    this.chartElement = '#oil-details';

    // Find the oil keys from the parsed URL
    _.forEach(Oci.data.info, function (value, key) {
      if (utils.makeId(key) === options.oil) { self.oilKey = key; }
      if (utils.makeId(key) === options.comparisonOil) { self.comparisonOilKey = key; }
    });

    // we show oil info if we have two oils, if one is a group, don't generate
    this.oil = utils.generateOilInfo(this.oilKey);
    if (this.comparisonOilKey) {
      this.comparisonOil = utils.generateOilInfo(this.comparisonOilKey);
    } else {
      this.comparisonOilKey = options.comparisonOil;
    }

    this.tip = d3.tip()
      .attr('class', 'd3-tip')
      .html(function (d, svg) {
        var unitsString = utils.getUnits('ghgTotal', 'perBarrel');
        var valuesString = '';
        var values = d.components[self.getStepName(svg)];
        for (var i = 0; i < values.length; i++) {
          valuesString += '<dt style="width:80%;">' + values[i].name + '</dt>';
          var value = Number(values[i].value);
          value = Math.abs(value) < 1 ? value.toFixed(1) : value.toFixed(0);
          valuesString += '<dd style="width:20%;">' + value + '</dd>';
        }
        return '<div class="popover in popover-compare"">' +
          '<div class="popover-inner">' +
            '<div class="popover-header clearfix">' +
              '<dl class="stats-list">' +
                '<dt>' + self.getStepName(svg) + ' emissions<small class="units">' + unitsString + '</small></dt><dd>' + self.dataForSvg(svg, d).toFixed(0) + '</dd>' +
              '</dl>' +
            '</div>' +
            '<div class="popover-body">' +
              '<dl class="stats-list">' +
              valuesString +
              '</dl>' +
            '</div>' +
          '</div>' +
        '</div>';
      })
      // set tooltip offset and direction differently if they are "too small"
      .offset(function (d, svg) {
        if (self.dataForSvg(svg, d) < self.xScale.domain()[1] * 0.3) {
          return [0, 25];
        } else {
          return [-10, 0];
        }
      })
      .direction(function (d, svg) {
        if (self.dataForSvg(svg, d) < self.xScale.domain()[1] * 0.3) {
          return 'e';
        } else {
          return 'n';
        }
      });

    this._windowSizing();
    this.render();
  },

  render: function () {
    var self = this;

    var comparisonOilName = (this.comparisonOil && this.comparisonOil.name) ||
      utils.groupIDtoName(this.comparisonOilKey);

    this.$el.html(this.template({
      utils: utils,
      oil: this.oil,
      comparisonOil: this.comparisonOil,
      // separate key so we can leave the above one blank for groups
      comparisonOilName: comparisonOilName,
      totalUnits: utils.getUnits('ghgTotal', 'perBarrel'),
      suggestedOils: (Oci.relatedOils[this.oilKey] || []),
      relatedOils: (Oci.relatedOils[this.oilKey] && Oci.relatedOils[this.oilKey].map(function (oil) {
        var d = Oci.data.info[oil];
        if (d) {
          return utils.createTooltipHtml(
            d.Unique,
            d['Overall Crude Category'],
            [
              {
                name: 'GHG Emissions',
                value: utils.numberWithCommas(d['Total Emissions']),
                units: utils.getUnits('ghgTotal', 'perBarrel')
              },
              {
                name: 'Current Production',
                value: utils.numberWithCommas(d['Oil Production Volume']),
                units: utils.getUnits('productionVolume')
              },
              {
                name: 'Estimated GHG Emission Rate',
                value: utils.numberWithCommas(Number(d['Total Emissions']) * Number(d['Oil Production Volume'])),
                units: utils.getUnits('emissionRate')
              }
            ],
            utils.makeId(d.Unique),
            '',
            d['Absolute Emissions Icons']
          );
        } else {
          return '';
        }
      }) || [])
    }));

    this.modelParametersView = new ModelParameters();
    this.$('#model-parameters').html(this.modelParametersView.render());
    this.listenTo(this.modelParametersView, 'sliderUpdate', this.handleParametersChange);

    Oci.data.metadata.refinery.split(', ').forEach(function (refinery, index) {
      // remove any refinery options the original oil doesn't have available
      if (!Oci.data.prelim['run' + index + '0'][self.oil.Unique]) {
        $('#dropdown-refinery option[value="' + refinery + '"]').hide();
      }
      if (self.comparisonOil) {
        // remove any refinery options the comparison oil doesn't have available
        if (!Oci.data.prelim['run' + index + '0'][self.comparisonOil.Unique]) {
          $('#dropdown-refinery option[value="' + refinery + '"]').hide();
        }
      } else {
        // check all group oils for their refinery
        _.filter(Oci.data.info, function (o) {
          return (o['Region'] === comparisonOilName ||
            o['Overall Crude Category'] === comparisonOilName);
        }).forEach(function (o) {
          if (!Oci.data.prelim['run' + index + '0'][o.Unique]) {
            $('#dropdown-refinery option[value="' + refinery + '"]').hide();
          }
        });
      }
    });

    // Determine bar heights
    this.comparisonModelHeight = (this.height - this.barBuffer) * (1 / 2);
    this.modelHeight = this.height - this.comparisonModelHeight;

    // For responsiveness
    this.width = $('.container-charts').width() - this.margin.left - this.margin.right;

    L.mapbox.accessToken = 'pk.eyJ1IjoiZGV2c2VlZCIsImEiOiJnUi1mbkVvIn0.018aLhX0Mb0tdtaT2QNe2Q';

    var map = L.mapbox.map('map', 'mapbox.light', {
      zoomControl: false,
      keyboard: false,
      tap: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false
    });

    // add marker for each oil field, make one active
    this.bounds = [];
    _.each([this.oil, this.comparisonOil], function (oil, i) {
      if (oil) {
        self.addMarker(oil, map, i === 0);
      } else {
        var compOils = _.filter(Oci.data.info, function (o) {
          return (o['Region'] === comparisonOilName ||
            o['Overall Crude Category'] === comparisonOilName) &&
            // don't map the main oil twice
            o.Unique !== self.oil.Unique;
        }).map(function (o) {
          return utils.generateOilInfo(o.Unique);
        });
        compOils.forEach(function (o) {
          self.addMarker(o, map);
        });
      }
    });

    var bounds = new L.latLngBounds(this.bounds); // eslint-disable-line new-cap
    map.fitBounds(bounds, {
      paddingTopLeft: [0, 180],
      paddingBottomRight: [0, 120]
    });

    this.chartInit();
    this._setupShare();
    this._activateSearchBar();
    this.activateCompareSearchBar();

    this._parseURLAndSetState();
    this.handleParametersChange();
    this.handleDropdown();
    this.hasShareLinkBeenParsed = true;
  },

  getStepName: function (svg) {
    return svg[0][0].parentNode.parentNode.id.split('-')[0];
  },

  updateSvg: function (svg) {
    var self = this;
    svg.selectAll('rect')
       .data(this.chartData)
       .transition()
       .duration(1000)
       .attr('width', function (d) {
         return self.xScale(self.dataForSvg(svg, d));
       });

    // Create small bars to indicate components
    var x0Oil = 0;
    var components = this.chartData[1].components[self.getStepName(svg)];
    svg.selectAll('.oilComponent')
       .data(components)
       .transition()
       .duration(1000)
       .attr('x', function (d) {
         x0Oil += +d.value;
         return self.xScale(x0Oil);
       });

    var x0ComparisonOil = 0;
    var comparisonComponents = this.chartData[0].components[self.getStepName(svg)];
    svg.selectAll('.comparisonOilComponent')
       .data(comparisonComponents)
       .transition()
       .duration(1000)
       .attr('x', function (d) {
         x0ComparisonOil += +d.value;
         return self.xScale(x0ComparisonOil);
       });

    // add text to show differences between the bars
    var diffData = {
      upstream: (this.chartData[1].upstream - this.chartData[0].upstream) / this.chartData[0].upstream,
      midstream: (this.chartData[1].midstream - this.chartData[0].midstream) / this.chartData[0].midstream,
      downstream: (this.chartData[1].downstream - this.chartData[0].downstream) / this.chartData[0].downstream
    };

    svg.selectAll('.diff-text')
       .data([diffData])
       .text(function (d) {
         var diff = self.dataForSvg(svg, d);
         return (diff > 0 ? '+' : '-') + Math.abs(diff * 100).toFixed(0) + '%';
       })
       .classed('invisible', function (d) {
         var diff = self.dataForSvg(svg, d);
         return Math.abs(diff) < 0.01;
       })
       .transition()
       .duration(1000)
       .attr('x', function (d) {
         return self.xScale(self.dataForSvg(svg, self.chartData[1])) + 12;
       });
  },

  createChartData: function () {
    // Grab things based on the model we're using
    var params = this.modelParametersView.getModelValues();
    var modelData = {
      info: Oci.data.info,
      opgee: Oci.data.opgee[utils.getOPGEEModel(params.solarSteam, params.water, params.flaring)],
      prelim: Oci.data.prelim[utils.getPRELIMModel(params.refinery, params.lpg)]
    };

    this.chartData = [
      utils.generateOilObject(this.comparisonOilKey, modelData, params.showCoke, params.lpg, true),
      utils.generateOilObject(this.oilKey, modelData, params.showCoke, params.lpg, false)
    ];
    $('#model-total').html(this.chartData[1].ghgTotal.toFixed(0));
    $('#comparison-model-total').html(this.chartData[0].ghgTotal.toFixed(0));
    // calculate comparison diff
    var compDiff = (this.chartData[1].ghgTotal - this.chartData[0].ghgTotal) / this.chartData[0].ghgTotal;
    var compDiffString = '(' + (compDiff > 0 ? '+' : '-') +
      Math.abs(compDiff * 100).toFixed(0) + '%)';
    $('#diff').html(compDiffString);
    $('#diff').removeClass('invisible');
    if (Math.abs(compDiff) < 0.01) {
      $('#diff').addClass('invisible');
    }
  },

  dataForSvg: function (svg, data) {
    if (svg === this.upstreamSvg) {
      return data.upstream;
    } else if (svg === this.downstreamSvg) {
      return data.downstream;
    } else if (svg === this.midstreamSvg) {
      return data.midstream;
    } else {
      console.warn('oops!');
    }
  },

  handleParametersChange: function () {
    this.createChartData();
    this.updateSvg(this.upstreamSvg);
    this.updateSvg(this.downstreamSvg);
    this.updateSvg(this.midstreamSvg);
    this._updateCopyLink();
  },

  createScales: function () {
    var self = this;

    var comparisonOilKey;
    if (Oci.regions.concat(Oci.types).indexOf(utils.groupIDtoName(this.comparisonOilKey)) > -1) {
      comparisonOilKey = null;
    } else {
      comparisonOilKey = this.comparisonOilKey;
    }

    this.xScale = d3.scale.linear()
      .domain([0, d3.max(this.chartData,
        function (d) {
          return d3.max([
            utils.getGlobalExtent('perBarrel', 'max', 'downstream', self.oilKey),
            utils.getGlobalExtent('perBarrel', 'max', 'midstream', self.oilKey),
            utils.getGlobalExtent('perBarrel', 'max', 'upstream', self.oilKey),
            utils.getGlobalExtent('perBarrel', 'max', 'downstream', comparisonOilKey),
            utils.getGlobalExtent('perBarrel', 'max', 'midstream', comparisonOilKey),
            utils.getGlobalExtent('perBarrel', 'max', 'upstream', comparisonOilKey)
          ]);
        })])
        .range([0, self.width]);
  },

  createData: function (svg) {
    var self = this;
    // Set label
    $('#default-total').html(this.chartData[0].ghgTotal.toFixed(0));
    $('#oil-name').html(this.oil.name);
    // Create bars
    svg.selectAll('rect')
       .data(this.chartData)
       .enter()
       .append('rect')
       .attr('x', function () { return self.xScale(0); })
       .attr('y', function (d) { return (d.isComparison) ? self.modelHeight + self.barBuffer : 0; })
       .attr('width', function (d) { return self.xScale(self.dataForSvg(svg, d)); })
       .attr('height', function (d) {
         return (d.isComparison) ? self.comparisonModelHeight : self.modelHeight;
       })
       .attr('rx', 2)
       .attr('ry', 2)
       .attr('class', function (d) { return (d.isComparison) ? 'compare' : 'main'; })
       .on('mouseover', function (d) { self.tip.show(d, svg); })
       .on('mouseout', function (d) {
         if (utils.insideTooltip(d3.event.clientX, d3.event.clientY)) {
           $('.d3-tip').on('mouseleave', function () {
             self.tip.hide();
           });
         } else {
           self.tip.hide();
         }
       });

    // Create small bars to indicate components if everything is positive
    var components = this.chartData[1].components[this.getStepName(svg)];
    var comparisonComponents = this.chartData[0].components[this.getStepName(svg)];
    var allPositive = _.every(components.concat(comparisonComponents),
      function (component) {
        return +component.value >= 0;
      }
    );
    if (allPositive) {
      var x0Oil = 0;
      svg.selectAll('.oilComponent')
         .data(components)
         .enter()
         .append('rect')
         .attr('class', 'oilComponent')
         .attr('pointer-events', 'none')
         .attr('x', function (d) {
           x0Oil += +d.value;
           return self.xScale(x0Oil);
         })
         .attr('y', 0)
         .attr('width', self.xScale(0.25))
         .attr('height', self.modelHeight)
         .attr('rx', 2)
         .attr('ry', 2)
         .attr('fill', '#fff');

      var x0ComparisonOil = 0;
      svg.selectAll('.comparisonOilComponent')
         .data(comparisonComponents)
         .enter()
         .append('rect')
         .attr('class', 'comparisonOilComponent')
         .attr('pointer-events', 'none')
         .attr('x', function (d) {
           x0ComparisonOil += +d.value;
           return self.xScale(x0ComparisonOil);
         })
         .attr('y', function (d) { return self.modelHeight + self.barBuffer; })
         .attr('width', self.xScale(0.25))
         .attr('height', self.modelHeight)
         .attr('rx', 2)
         .attr('ry', 2)
         .attr('fill', '#fff');
    }

    // add text to show differences between the bars
    var diffData = {
      upstream: (this.chartData[1].upstream - this.chartData[0].upstream) / this.chartData[0].upstream,
      midstream: (this.chartData[1].midstream - this.chartData[0].midstream) / this.chartData[0].midstream,
      downstream: (this.chartData[1].downstream - this.chartData[0].downstream) / this.chartData[0].downstream
    };

    svg.selectAll('.diff-text')
       .data([diffData])
       .enter()
       .append('text')
       .text(function (d) {
         var diff = self.dataForSvg(svg, d);
         return (diff > 0 ? '+' : '-') + Math.abs(diff * 100).toFixed(0) + '%';
       })
       .classed('invisible', function (d) {
         var diff = self.dataForSvg(svg, d);
         return Math.abs(diff) < 0.01;
       })
       .attr('x', function (d) {
         return self.xScale(self.dataForSvg(svg, self.chartData[1])) + 12;
       })
       .attr('y', self.modelHeight / 2 + 4)
       .attr('class', 'diff-text');
  },

  chartInit: function () {
    var width = this.width;
    var height = this.height;
    var margin = this.margin;

    // Create SVG element
    this.upstreamSvg = d3.select('#upstream-bar')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    this.downstreamSvg = d3.select('#downstream-bar')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    this.midstreamSvg = d3.select('#midstream-bar')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform',
                      'translate(' + margin.left + ',' + margin.top + ')');

    // Invoke the tooltip
    this.upstreamSvg.call(this.tip);
    this.midstreamSvg.call(this.tip);
    this.downstreamSvg.call(this.tip);

    this.createChartData();
    this.createScales();
    this.createData(this.upstreamSvg);
    this.createData(this.midstreamSvg);
    this.createData(this.downstreamSvg);
  },

  handleDropdown: function () {
    $('.config-dropdown').blur();
    this.handleParametersChange();
  },
  // overwrite base _handleResize function
  _handleResize: function () {
    this.width = $('.container-charts').width() - this.margin.left - this.margin.right;
    // Clear anything in the svg element since we're going to rewrite
    d3.select('#upstream-bar').html('');
    d3.select('#midstream-bar').html('');
    d3.select('#downstream-bar').html('');
    this.chartInit();
  },

  handleShare: function (e) {
    e.preventDefault();
  },

  handleCarosel: function (e) {
    var increment = $(e.currentTarget).hasClass('forward') ? 1 : -1;
    var currentOffset;
    var $carosel = $(e.currentTarget).parent().find('.carosel');
    var $arrows = $('.carosel-arrow');

    [0, 1, 2, 3, 4].forEach(function (offset) {
      if ($carosel.hasClass('offset-' + offset)) {
        currentOffset = offset;
      }
    });
    $carosel.removeClass('offset-' + currentOffset);
    $arrows.removeClass('offset-' + currentOffset);
    $carosel.addClass('offset-' + (Number(currentOffset) + increment));
    $arrows.addClass('offset-' + (Number(currentOffset) + increment));
  },

  openCompare: function (e) {
    e.preventDefault();
    e.stopPropagation();
    var $targetDiv = $(e.currentTarget).parent().find('.dropdown-compare');
    $targetDiv.toggleClass('open');
    if ($targetDiv.hasClass('open')) {
      $targetDiv.find('input').focus();
    }
  },

  activateCompareSearchBar: function () {
    var self = this;
    var oilNames = [];
    _.forEach(Oci.data.info, function (oil) {
      oilNames.push(oil.Unique);
    });
    oilNames = oilNames.concat(Oci.regions, Oci.types);

    var CHARACTER_LIMIT = 1;
    $('.dropdown-compare input').on('input', function () {
      // Determine which oils match the partially-typed name
      var search = $(this).val();
      var re = new RegExp(search, 'i');
      var matchedNames = oilNames.filter(function (oilName) {
        return (
          search.length >= CHARACTER_LIMIT &&
          oilName.search(re) > -1
        );
      });

      // Create and insert the HTML
      var resultsHTML = matchedNames.map(function (oilName) {
        var oilID = utils.makeId(oilName);
        return '<div class="search-result"><a href="#compare/' + utils.makeId(self.oilKey) +
          '/' + oilID + '">' + oilName + '</a></div>';
      }).join('');
      $(this).parent().find('.search-results').html(resultsHTML);
    });

    // handle focus/blur on inputs
    // TODO: maybe check if this needs to be unbound
    $('.dropdown-compare input').focus(function (e) {
      $(e.currentTarget).parent().find('.search-results').addClass('visible');
    });

    $('.dropdown-compare input').blur(function (e) {
      setTimeout(function () {
        $(e.currentTarget).parent().find('.search-results').removeClass('visible');
      }, 200);
    });

    $('body').on('click.custom', function () {
      $('.dropdown-compare').removeClass('open');
    });

    $('.dropdown-compare').on('click.custom', function (e) {
      e.stopPropagation();
    });

    $('.dropdown-compare input').on('keyup', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var $container = $(this).parent().find('.search-results');
      var $results = $(this).parent().find('.search-result');
      var $previous, $next, $newActive;
      var oneActive = $results.hasClass('active');
      var $active = $results.parent().find('.active');

      if ($container.html()) {
        switch (e.keyCode) {
          case 38: // up
            if (oneActive) {
              $active.removeClass('active');
              $previous = $active.prev();
              // if a previous element exists, that becomes active, otherwise
              // go to the end
              // make sure our active result stays in view
              if ($previous.length) {
                $newActive = $previous.addClass('active');
                if ($newActive.position().top < 0) {
                  $container.scrollTop($container.scrollTop() - $newActive.outerHeight());
                }
              } else {
                $results.last().addClass('active');
                $container.scrollTop($container[0].scrollHeight);
              }
            } else {
              $results.last().addClass('active');
              $container.scrollTop($container[0].scrollHeight);
            }
            break;
          case 40: // down
            if (oneActive) {
              $active.removeClass('active');
              $next = $active.next();
              // if a next element exists, that becomes active, otherwise start
              // at the beginning
              // make sure our active result stays in view
              if ($next.length) {
                $newActive = $next.addClass('active');
                if ($newActive.position().top + $newActive.outerHeight() > $container.outerHeight()) {
                  $container.scrollTop($container.scrollTop() + $newActive.outerHeight());
                }
              } else {
                $results.first().addClass('active');
                $container.scrollTop(0);
              }
            } else {
              $results.first().addClass('active');
            }
            break;
          case 13: // enter/return
            if ($results.hasClass('active')) {
              Oci.router.navigate($active.find('a').attr('href'), {trigger: true});
            }
            break;
        }
      }
    });
  },

  addMarker: function (oil, map, main) {
    var icon = L.divIcon({
      html: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: 'map-oil' + (main ? ' map-oil-main' : '')
    });

    var oilfield = utils.getOilfield(oil.Unique);
    var centroid = turfCentroid(oilfield);
    var marker = L.marker([centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]], {icon: icon, clickable: false});
    this.bounds.push(marker.getLatLng());
    marker.addTo(map);
  }
});

module.exports = CompareView;
