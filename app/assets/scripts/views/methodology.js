'use strict';

var $ = require('jquery');
var utils = require('../utils');

var template = require('../templates/methodology.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var Methodology = BaseView.extend({

  template: template,

  el: '.content',

  events: {
    'click .same-page-nav': 'navigateWithinPage'
  },

  initialize: function (options) {
    this._windowSizing();
    this.render(options.scrollTo);
    $(window).on('scroll.custom', this.checkDataControlsPosition.bind(this));
  },

  render: function (scrollTo) {
    this.$el.html(this.template({blueBar: blueBar()}));
    this._activateSearchBar();
    this.wrapperOffset = $('.doc-nav').offset();
    this.checkDataControlsPosition();

    // Scroll to the desired element
    if (scrollTo) {
      utils.scrollToElementWithID(scrollTo);
    }
  },

  checkDataControlsPosition: function () {
    var $element = $('.doc-nav');
    if (!$element.length) { return; }
    var parentSection = $('#methodology-view');
    var parentSectionHeight = parentSection.height();
    var bottomLimit = parentSectionHeight + parentSection.offset().top;

    if ($(window).scrollTop() + 90 >= this.wrapperOffset.top) {
      $element.addClass('sticky');
      $element.removeClass('bottom');
    } else {
      $element.removeClass('sticky');
    }

    if ($element.offset().top + $element.height() > bottomLimit) {
      $element.addClass('bottom');
      $element.removeClass('sticky');
    } else {
      $element.removeClass('bottom');
    }
  },

  navigateWithinPage: function (e) {
    e.preventDefault();
    var elementID = e.currentTarget.href.split('#methodology/')[1];
    utils.scrollToElementWithID(elementID);
  }
});

module.exports = Methodology;
