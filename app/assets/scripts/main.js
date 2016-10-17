/*global Oci */
'use strict';

// TODO: add this to a vendor file or something
require('./wnumb');

var $ = require('jquery');
import _ from 'lodash';
var Backbone = require('backbone');
var Clipboard = require('clipboard');
var utils = require('./utils');

var Router = require('./routes/router');

// Collections
var OilFields = require('./collections/oil-fields');
var Prices = require('./collections/prices');
var Related = require('./collections/related');
var Blurbs = require('./collections/blurbs');
var Info = require('./collections/info');
var GlobalExtents = require('./collections/global-extents');
var Metadata = require('./collections/metadata');

// globalish scroll tracker
var scroll = window.scrollY;

window.Oci = {
  Models: {},
  Collections: {},
  Views: {},
  Routers: {},
  init: function () {
    // Oci.getData();
    Oci.getGlobalExtents();
    Oci.getInfo();
    Oci.getPrices();
    Oci.getBlurbs();
    Oci.getOilfields();
    Oci.getRelated();
    Oci.getMetadata();
    Oci.router = new Router();
    Backbone.history.start();
  },

  getData: function () {
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

  getInfo: function () {
    var info = new Info();
    info.fetch({
      success: function (data) {
        Oci.data.info = data.attributes;
        Oci.regions = _.uniq(_.map(data.attributes, function (oil) {
          return oil['Region'];
        }));
        Oci.types = _.uniq(_.map(data.attributes, function (oil) {
          return oil['Overall Crude Category'];
        }));
      },
      async: false
    });
  },

  getGlobalExtents: function () {
    var globalExtents = new GlobalExtents();
    globalExtents.fetch({
      success: function (data) {
        Oci.data.globalExtents = data.attributes;
      },
      async: false
    });
  },

  getBlurbs: function () {
    var blurbs = new Blurbs();
    blurbs.fetch({
      success: function (data) {
        Oci.blurbs = data.attributes;
      },
      async: false
    });
  },

  getOilfields: function () {
    var oilFields = new OilFields();
    oilFields.fetch({
      async: false,
      success: function (data) {
        Oci.oilfields = data.attributes;
      }
    });
  },

  getPrices: function () {
    var prices = new Prices();
    prices.fetch({
      success: function (data) {
        Oci.prices = data.attributes;
        Oci.origPrices = utils.cloneObject(data.attributes);
      },
      async: false
    });
  },

  getRelated: function () {
    var related = new Related();
    related.fetch({
      success: function (data) {
        Oci.relatedOils = data.attributes;
      },
      async: false
    });
  },

  getMetadata: function () {
    var metadata = new Metadata();
    metadata.fetch({
      success: function (data) {
        Oci.data.metadata = data.attributes;
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
  data: {
    globalExtents: {}
  },
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
