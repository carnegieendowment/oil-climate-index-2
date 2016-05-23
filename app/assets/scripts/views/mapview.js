/* globals Oci, L */
'use strict';

var $ = require('jquery');
var _ = require('lodash');
var d3 = require('d3');
require('d3-tip');

var utils = require('../utils');

var template = require('../templates/mapview.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');
require('mapbox.js');
var turfCentroid = require('turf-centroid');

var MapView = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'change #year-select': 'handleYearChange',
    'click .world-zoom': 'worldZoom',
    'click .zoom-field': 'handleZoomToField'
  },

  initialize: function () {
    var self = this;
    this.hasShareLinkBeenParsed = false;

    this.SWITCH_FROM_MARKERS_TO_POLYGONS_AT_ZOOM = 6;

    var oils = [];
    _.forEach(Oci.data.info, function (oil) { oils.push(oil); });

    this.range = [
      Number(_.minBy(oils, function (oil) { return Number(oil['Total Emissions']); })['Total Emissions']),
      Number(_.maxBy(oils, function (oil) { return Number(oil['Total Emissions']); })['Total Emissions'])
    ];

    this.shareParams = [
      { name: 'yearSelect', input: 'year-select' }
    ];

    this._windowSizing();
    this.render();

    this.fillColor = '#ddd';
    this.radiusRange = [5, 35];

    this.radiusScale = d3.scale.sqrt()
      .domain(this.range)
      .range(this.radiusRange);

    // Adds Bounds for map
    var southWest = L.latLng(-90, -250);
    var northEast = L.latLng(90, 250);
    var bounds = L.latLngBounds(southWest, northEast);

    L.mapbox.accessToken = 'pk.eyJ1IjoiZGV2c2VlZCIsImEiOiJnUi1mbkVvIn0.018aLhX0Mb0tdtaT2QNe2Q';
    this.flaringLayers = {
      '2012': L.mapbox.tileLayer('carnegiecomms.9c2f044c'),
      '2013': L.mapbox.tileLayer('carnegiecomms.9e285c3e'),
      '2014': L.mapbox.tileLayer('carnegiecomms.1d1c0ebe'),
      'off': null
    };
    var map = L.mapbox.map(
      'map',
      'carnegiecomms.34955fec',
      {
        zoomControl: false,
        scrollWheelZoom: false,
        maxBounds: bounds,
        maxZoom: 18
      }
    )
    .addLayer(this.flaringLayers['2014'])
    .setView([30, 0], 2);

    new L.Control.Zoom({ position: 'bottomright' }).addTo(map);
    this.map = map;

    this.markers = [];
    var polygons = [];
    oils.forEach(function (oil) {
      var oilfield = utils.getOilfield(oil.Unique);

      if (oilfield) {
        var centroid = turfCentroid(oilfield);
        var radiusValue = Number(oil['Total Emissions']);
        var ghgTotal = utils.numberWithCommas(oil['Total Emissions']);

        var tooltip = utils.createTooltipHtml(
          oil.Unique,
          oil['Overall Crude Category'],
          [
            {
              name: 'GHG Emissions',
              value: ghgTotal,
              units: utils.getUnits('ghgTotal', 'perBarrel')
            }
          ],
          utils.makeId(oil.Unique),
          '',
          oil['Absolute Emissions Icons'],
          '',
          true,
          utils.getDataQuality(oil.Unique).total
        );
        var tooltipOptions = {
          closeButton: false
        };

        // Circle marker style, default & interactive
        var marker = L.circleMarker(
          centroid.geometry.coordinates.reverse(), {
            radius: self.radiusScale(radiusValue),
            stroke: true,
            weight: 0.75,
            color: '#222',
            fillColor: self.fillColor,
            fillOpacity: 0.2,
            className: utils.makeId(oil.Unique)
          }).bindPopup(tooltip, tooltipOptions).on({
            'mouseover': function () {
              marker.setStyle({
                color: 'white',
                weight: 1.5
              });
            },
            'mouseout': function () {
              marker.setStyle({
                color: '#222',
                weight: 0.75
              });
            }
          });
        self.markers.push(marker);

        // Need a special double-tooltip if the Bakken oilfield is selected
        // In this case, two oils share the same exact field
        if (utils.makeId(oil.Unique).indexOf('us-bakken') > -1) {
          tooltip = self.makeBakkenTooltip();
        }

        // Polygon Style, default & interactive
        var polygon = L.geoJson(oilfield, {
          fillColor: '#FFF',
          fillOpacity: 0.2,
          color: 'white',
          weight: 2.5,
          className: utils.makeId(oil.Unique)
        }).bindPopup(tooltip, tooltipOptions).on({
          'mouseover': function () {
            polygon.setStyle({
              weight: 4,
              fillOpacity: 0
            });
          },
          'mouseout': function () {
            polygon.setStyle({
              weight: 2.5,
              fillOpacity: 0.3
            });
          }
        });
        polygons.push(polygon);
      }
    });

    // Make sure that smaller circles show up on top
    _.sortBy(self.markers, function (marker) { return marker._radius * -1; }).forEach(function (marker) {
      map.addLayer(marker);
    });

    // Initialize the map showing markers, not polygons
    // Adjust which is being shown based on map zoom
    map.on('zoomend', function () {
      if (map.getZoom() > self.SWITCH_FROM_MARKERS_TO_POLYGONS_AT_ZOOM) {
        self.markers.forEach(function (layer) { map.removeLayer(layer); });
        polygons.forEach(function (layer) { map.addLayer(layer); });
      } else {
        self.markers.forEach(function (layer) { map.addLayer(layer); });
        polygons.forEach(function (layer) { map.removeLayer(layer); });
      }
    });

    // add this layer so we can bind events to it, then remove
    polygons.forEach(function (layer) { map.addLayer(layer); });
    var mapSvg = d3.select('.leaflet-overlay-pane svg');
    mapSvg.selectAll('path').on('dblclick', function () {
      var key = d3.event.target.classList[0];
      self.handleZoomToField(null, key);
    });
    polygons.forEach(function (layer) { map.removeLayer(layer); });

    this.createLegend();

    this._parseURLAndSetState();
    this.handleYearChange();
    this.hasShareLinkBeenParsed = true;
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));
    this._setupShare();
    this._activateSearchBar();
  },

  createLegend: function () {
    var self = this;

    // Create legend element
    var margin = 10;
    var width = 180;
    var height = 230;

    var legend = d3.select('#bubble-legend')
      .append('svg')
      .attr('width', width + margin + margin)
      .attr('height', height + margin + margin)
        .append('g')
      .attr('transform', 'translate(' + margin + ',' + margin + ')');

    // Hard-code emissions information
    var data = [900, 700, 500];
    var labelHeights = [0, 33, 72];
    var name = 'Total Emissions';
    var units = utils.getUnits('ghgTotal', 'perBarrel');

    // Set the values that will be plotted
    var radii = data.map(function (datum) { return self.radiusScale(datum); });
    var maxRadius = _.max(radii);
    var BASE_CY = 50;
    var cys = radii.map(function (radius) { return BASE_CY + (maxRadius - radius); });
    var cx = 80;

    legend.selectAll('.circle-legend')
       .data(data)
       .enter()
       .append('circle')
       .classed('circle-legend', true)
       .attr('fill-opacity', '0')
       .attr('stroke', '#777')
       .attr('cx', cx)
       .attr('cy', function (d, i) { return cys[i]; })
       .attr('r', function (d, i) { return radii[i]; });

    legend.selectAll('.circle-legend')
       .data(data)
       .attr('cx', cx)
       .attr('cy', function (d, i) { return cys[i]; })
       .attr('r', function (d, i) { return radii[i]; });

    legend.selectAll('.circle-text')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'circle-text')
      .attr('x', cx)
      .attr('y', function (d, i) { return labelHeights[i]; })
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .text(function (d, i) { return data[i]; });

    legend.append('text')
      .attr('x', cx)
      .attr('y', 116)
      .attr('text-anchor', 'middle')
      .attr('class', 'circle-text, legend-name')
      .style('fill', '#fff')
      .text(name);

    legend.append('text')
      .attr('x', cx)
      .attr('y', 132)
      .attr('text-anchor', 'middle')
      .attr('class', 'circle-text, legend-units')
      .style('fill', '#fff')
      .text(units);

    // Create flaring legend
    var flaringXs = [-50, -25, 0, 25, 50];
    var flaringY = 180;
    var flaringLabels = ['0+', '1+', '2+', '3+', '4+'];
    var flaringLabelY = 199;
    var flaringRadius = 3;
    var flaringColors = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#f03b20'];
    var flaringName = 'Annual Flaring';
    var flaringUnits = 'million m\u00B3';

    legend.selectAll('.dot-legend')
       .data(flaringLabels)
       .enter()
       .append('circle')
       .classed('dot-legend', true)
       .attr('cx', function (d, i) { return cx + flaringXs[i]; })
       .attr('cy', flaringY)
       .attr('r', flaringRadius)
       .attr('fill', function (d, i) { return flaringColors[i]; });

    legend.selectAll('.dot-text')
      .data(flaringLabels)
      .enter()
      .append('text')
      .attr('class', 'dot-text')
       .attr('x', function (d, i) { return cx + flaringXs[i] + 3; })
       .attr('y', flaringLabelY)
      .attr('text-anchor', 'middle')
      .style('fill', '#fff')
      .text(function (d, i) { return d; });

    legend.append('text')
      .attr('x', cx)
      .attr('y', 220)
      .attr('text-anchor', 'middle')
      .attr('class', 'dot-label, legend-name')
      .style('fill', '#fff')
      .text(flaringName);

    legend.append('text')
      .attr('x', cx)
      .attr('y', 233)
      .attr('text-anchor', 'middle')
      .attr('class', 'dot-label, legend-units')
      .style('fill', '#fff')
      .text(flaringUnits);
  },

  // called with event or id
  handleZoomToField: function (e, id) {
    if (e) {
      id = e.currentTarget.classList[4];
    }
    // Find the oil key from the id
    var oil;
    for (var key in Oci.data.info) {
      if (utils.makeId(key) === id) {
        oil = Oci.data.info[key];
        break;
      }
    }
    var oilfield = utils.getOilfield(oil.Unique);
    var centroid = turfCentroid(oilfield);
    this.map.setView(centroid.geometry.coordinates.reverse(),
      this.SWITCH_FROM_MARKERS_TO_POLYGONS_AT_ZOOM + 2);
  },

  worldZoom: function () {
    this.map.setView([30, 0], 2);
  },

  handleYearChange: function () {
    var self = this;
    _.forEach(this.flaringLayers, function (value, key) {
      if (self.map.hasLayer(value)) { self.map.removeLayer(value); }
    });

    var year = $('[name=year-select]:checked').val();
    var layer = this.flaringLayers[year];
    if (layer) { this.map.addLayer(layer); }

    this._updateCopyLink();
  },

  makeBakkenTooltip: function (d) {
    // Find the oil keys
    var bakkenOils = [];
    for (var key in Oci.data.info) {
      if (utils.makeId(key).indexOf('us-bakken') > -1) {
        bakkenOils.push(Oci.data.info[key]);
      }
    }

    // Build tooltip
    var tooltips = [];
    bakkenOils.forEach(function (oil) {
      var ghgTotal = utils.numberWithCommas(oil['Total Emissions']);
      var oilHTML = utils.createTooltipHtml(
        oil.Unique,
        oil['Overall Crude Category'],
        [
          {
            name: 'GHG Emissions',
            value: ghgTotal,
            units: utils.getUnits('ghgTotal', 'perBarrel')
          }
        ],
        utils.makeId(oil.Unique),
        '',
        oil['Absolute Emissions Icons'],
        '',
        true
      );

      tooltips.push(oilHTML);
    });

    // Reformat the elements so that they form one double-decker tooltip
    var doubleDecker = '';
    var parentTags = tooltips[0].match(/^<div.+?><div.+?>/g)[0];
    tooltips.forEach(function (tooltip) {
      var innerHTML = $.parseHTML(tooltip)[0].innerHTML;
      innerHTML = $.parseHTML(innerHTML)[0].innerHTML;
      doubleDecker += innerHTML;
    });
    doubleDecker = parentTags + doubleDecker + '</div></div>';

    return doubleDecker;
  }
});

module.exports = MapView;
