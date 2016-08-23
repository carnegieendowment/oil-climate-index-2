/* global Oci, ga */
'use strict';

var Backbone = require('backbone');
var $ = require('jquery');

var Prices = require('../views/prices');
var SupplyCurve = require('../views/supplycurve');
var CompareOils = require('../views/compareoils');
var EmissionsDrivers = require('../views/emissionsdrivers');
var OilDetails = require('../views/oildetails');
var HomePage = require('../views/homepage');
var MapView = require('../views/mapview');
var CompareView = require('../views/compareview');
var About = require('../views/about');
var Glossary = require('../views/glossary');
var Methodology = require('../views/methodology');
var Team = require('../views/team');
var Models = require('../views/models');
var TermsOfUse = require('../views/termsofuse');
var DemoVideos = require('../views/demovideos');

var demoViewDuration = 5000;

var router = Backbone.Router.extend({

  initialize: function () {
    // Create prices view
    new Prices(); // eslint-disable-line
  },

  routes: {
    '': 'homePage',
    'total-emissions': 'production',
    'supply-chain': 'supplyChain',
    'analysis': 'oilAttributes',
    'oil/:id': 'oilDetails',
    'compare/:id/:compid': 'compareView',
    'map': 'location',
    'about': 'about',
    'glossary(/:elementID)': 'glossary',
    'methodology(/:elementID)': 'methodology',
    'team': 'team',
    'models': 'models',
    'termsofuse': 'termsofuse',
    'demovideos': 'demovideos',
    'demo': 'playDemo'
  },

  playDemo: function () {
    var self = this;

    var index = 0;
    var showView = function () {
      switch (index) {
        case 0:
          self.execute(self.supplyCurve, [null]);
          break;
        case 1:
          self.execute(self.compareOils, [null]);
          break;
        case 2:
          self.execute(self.emissionsDrivers, [null]);
          break;
        case 3:
          self.execute(self.oilDetails, ['us-alaskan-north-slope', null]);
          break;
      }
      setTimeout(function () {
        index = (index + 1) % 4;
        showView();
      }, demoViewDuration);
    };
    showView();
  },

  execute: function (callback, args) {
    this.allRoutes();
    if (callback) {
      callback.apply(this, args);
    }
  },

  production: function () {
    Oci.view = new SupplyCurve();
    $('#menu-production').addClass('active');
    $(window).scrollTop(0);
  },

  supplyChain: function () {
    Oci.view = new CompareOils();
    $('#menu-supply').addClass('active');
    $(window).scrollTop(0);
  },

  oilAttributes: function () {
    Oci.view = new EmissionsDrivers();
    $('#menu-attributes').addClass('active');
    $(window).scrollTop(0);
  },

  oilDetails: function (id) {
    Oci.view = new OilDetails({oil: id});
    $(window).scrollTop(0);
  },

  compareView: function (id, compid) {
    Oci.view = new CompareView({oil: id, comparisonOil: compid});
    $(window).scrollTop(0);
  },

  homePage: function () {
    Oci.view = new HomePage();
    $(window).scrollTop(0);
  },

  location: function () {
    Oci.view = new MapView();
    $('#menu-location').addClass('active');
    $(window).scrollTop(0);
  },

  about: function () {
    Oci.view = new About();
    $('#menu-about').addClass('active');
    $(window).scrollTop(0);
  },

  glossary: function (elementID) {
    Oci.view = new Glossary({ scrollTo: elementID });
    $('#menu-glossary').addClass('active');
    $(window).scrollTop(0);
  },

  methodology: function (elementID) {
    Oci.view = new Methodology({ scrollTo: elementID });
    $('#menu-methodology').addClass('active');
    $(window).scrollTop(0);
  },

  team: function () {
    Oci.view = new Team();
    $('#menu-about').addClass('active');
    $(window).scrollTop(0);
  },

  models: function () {
    Oci.view = new Models();
    $('#menu-about').addClass('active');
    $(window).scrollTop(0);
  },

  termsofuse: function () {
    Oci.view = new TermsOfUse();
    $('#menu-termsofuse').addClass('active');
    $(window).scrollTop(0);
  },

  demovideos: function () {
    Oci.view = new DemoVideos();
    $('#menu-demovideos').addClass('active');
    $(window).scrollTop(0);
  },

  allRoutes: function () {
    if (Oci.view) {
      $('body').unbind();
      $(window).off('resize');
      Oci.view.undelegateEvents();
      $(window).off('scroll.custom');
      $('body').off('click.custom');
      // Remove old tooltips
      $('.d3-tip').remove();
      // Unset active states for header items
      $('#menu-block li').removeClass('active');
      $('#menu-supply').removeClass('active');

      // remove search listeners
      $('.component-search input').off('input');
      $('.component-search input').off('keyup');

      // Remove lingering search text and results
      $('.component-search input').val('');
      $('.component-search .search-results').html('');
    }
    // sends page information to google analytics
    ga('send', 'pageview', window.location.hash);
  }
});
module.exports = router;
