'use strict';

var template = require('../templates/team.ejs');
var blueBar = require('../templates/bluebar.ejs');
var BaseView = require('./baseview');

var Team = BaseView.extend({

  template: template,

  el: '.content',

  events: {},

  initialize: function () {
    this._windowSizing();
    this.render();
  },

  render: function () {
    this.$el.html(this.template({blueBar: blueBar()}));
    this._activateSearchBar();
  }
});

module.exports = Team;
