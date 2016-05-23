'use strict';

var utils = require('../utils');

var template = require('../templates/glossary.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var Glossary = BaseView.extend({

  template: template,

  el: '.content',

  events: {},

  initialize: function (options) {
    this._windowSizing();
    this.render(options.scrollTo);
  },

  render: function (scrollTo) {
    this.$el.html(this.template({blueBar: blueBar()}));
    this._activateSearchBar();

    // Scroll to the desired element
    if (scrollTo) {
      utils.scrollToElementWithID(scrollTo);
    }
  }
});

module.exports = Glossary;
