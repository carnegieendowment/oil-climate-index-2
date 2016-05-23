/*global Oci */
'use strict';

// TODO: add this to a vendor file or something
require('./wnumb');

var $ = require('jquery');
var _ = require('lodash');
var Backbone = require('backbone');
var Clipboard = require('clipboard');
var utils = require('./utils');

var Router = require('./routes/router');

// globalish scroll tracker
var scroll = window.scrollY;

window.Oci = {
  Models: {},
  Collections: {},
  Views: {},
  Routers: {},
  init: function () {
    Oci.getData();
    Oci.getPrices();
    Oci.getBlurbs();
    Oci.getOilfields();
    Oci.getRelated();
    Oci.router = new Router();
    Backbone.history.start();
  },

  getData: function () {
    // synchronous AJAX call because the file is small and we need it to render all the graphs
    // technically we could start rending other things first and have the d3 trigger on load
    $.ajax({
      type: 'GET',
      url: 'assets/data/oils.json',
      dataType: 'json',
      success: function (data) {
        Oci.data = data;
        Oci.data.globalExtents = {};
        Oci.regions = _.uniq(_.map(data.info, function (oil) {
          return oil['Region'];
        }));
        Oci.types = _.uniq(_.map(data.info, function (oil) {
          return oil['Overall Crude Category'];
        }));
      },
      async: false
    });
  },
  getBlurbs: function () {
    // synchronous AJAX call because the file is small and we need it to render all the graphs
    // technically we could start rending other things first and have the d3 trigger on load
    $.ajax({
      type: 'GET',
      url: 'assets/data/blurbs.json',
      dataType: 'json',
      success: function (data) {
        Oci.blurbs = data;
      },
      async: false
    });
  },
  getOilfields: function () {
    // synchronous AJAX call because the file is small and we need it to render all the graphs
    // technically we could start rending other things first and have the d3 trigger on load
    $.ajax({
      type: 'GET',
      url: 'assets/data/oilfields.geojson',
      dataType: 'json',
      success: function (data) {
        Oci.oilfields = data;
      },
      async: false
    });
  },
  getPrices: function () {
    $.ajax({
      type: 'GET',
      url: 'assets/data/prices.json',
      dataType: 'json',
      success: function (data) {
        Oci.prices = data;
        Oci.origPrices = utils.cloneObject(data);
      },
      async: false
    });
  },
  getRelated: function () {
    $.ajax({
      type: 'GET',
      url: 'assets/data/related.json',
      dataType: 'json',
      success: function (data) {
        Oci.relatedOils = data;
      },
      async: false
    });
  },
  showPricesModal: function (tf) {
    if (tf) {
      $('#modal-prices').addClass('revealed');
    } else {
      $('#modal-prices').removeClass('revealed');
    }
  },
  prices: {},
  data: {},
  carbonTax: 20,
  order: {
    upstream: ['Exploration', 'Drilling', 'Production', 'Processing', 'Upgrading', 'Maintenance', 'Waste', 'Venting, Flaring, and Fugitive Emissions', 'Diluent', 'Miscellaneous', 'Transport to Refinery', 'Offsite emissions'],
    downstream: ['Transport to Consumers', 'Gasoline', 'Jet Fuel', 'Diesel', 'Fuel Oil', 'Petroleum Coke', 'Residual Fuels', 'Light Ends (RFG)', 'Liquefied Petroleum Gas (LPG)']
  }
};

$(document).ready(function () {
  Oci.init();

  // page nav dropdown behaviour on small screens
  $('[data-dropdown-nav]').click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    $(this).parents('nav.page-nav').toggleClass('open');
  });

  $(document).click(function (e) {
    e.stopPropagation();
    if (e.target.id !== 'searchbar-mobile') {
      $('nav.page-nav').removeClass('open');
    }
  });

  $('.meta-menu .meta-menu-element').hover(
    function () { $(this).find('.menu-dropdown').addClass('open'); },
    function () { $(this).find('.menu-dropdown').removeClass('open'); }
  );

  // for link sharing
  var clipboard = new Clipboard('li.copylink');
  $('li.copylink').attr('data-clipboard-text', window.location);
  clipboard.on('success', function (e) {
    $(e.trigger).attr('data-title-after', 'Copied!');
  });
  clipboard.on('error', function (e) {
    $(e.trigger).attr('data-title-after', utils.fallbackMessage(e.action));
  });
  $('li.copylink').on('mouseout', function (e) {
    $(e.currentTarget).removeAttr('data-title-after');
  });

  $(window).scroll(function () {
    if ($(this).scrollTop() > 300) {
      if (window.scrollY > scroll) {
        $('#site-header').addClass('site-header-sticky-share');
      } else if (window.scrollY < scroll) {
        $('#site-header').removeClass('site-header-sticky-share');
      }
    } else {
      $('#site-header').removeClass('site-header-sticky-share');
    }
    scroll = window.scrollY;
  });

  $('.icon-main-share').click(function () {
    $('.nav-component-share').toggleClass('share-nav-open');
  });

  $('.search-main input').focus(function (e) {
    $(e.currentTarget).parent().find('.search-results').addClass('visible');
  });

  $('.search-main input').blur(function (e) {
    setTimeout(function () {
      $(e.currentTarget).parent().find('.search-results').removeClass('visible');
    }, 200);
  });
});
