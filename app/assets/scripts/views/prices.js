/*global Oci */
'use strict';
var Backbone = require('backbone');
var $ = require('jquery');

var utils = require('../utils');

var template = require('../templates/prices.ejs');

var self;

var prices = Backbone.View.extend({

  template: template,

  el: '#modal-prices',

  events: {
    'click .apply': 'handleApply',
    'click [data-modal-dismiss]': 'handleDismissClick',
    'keyup .price-input': 'verifyPrice',
    'click .reset': 'handleReset'
  },

  initialize: function () {
    self = this;

    this.render();
    this.loadPrices();
  },

  render: function () {
    this.$el.html(this.template());
  },

  loadPrices: function () {
    for (var key in Oci.prices) {
      var s = 'input[name="' + key + '"]';
      $(s).val(parseFloat(Oci.prices[key].currentPrice).toFixed(2));
    }
  },

  handleDismissClick: function (e) {
    e.preventDefault();
    Oci.showPricesModal(false);
    self.loadPrices();
  },

  handleApply: function (e) {
    e.preventDefault();

    // Close window
    Oci.showPricesModal(false);

    // Save values
    for (var key in Oci.prices) {
      var s = 'input[name="' + key + '"]';
      var field = $(s);
      var val = parseFloat(field.val()).toFixed(2);
      field.val(val);
      Oci.prices[key].currentPrice = val;
    }

    // Tell the current view to update its prices
    if (Oci.view.updatePrices) {
      Oci.view.updatePrices();
    }
  },

  // Try to make sure we have a valid price input
  verifyPrice: function (e) {
    var input = e.target;
    var valid = /^\d{0,5}(\.\d{0,2})?$/.test(input.value);

    if (!valid) {
      var newValue = input.value;
      newValue = newValue.replace(/[^\d.]/g, '');
      newValue = parseFloat(newValue).toFixed(2);
      // Take care of NaN case or too many numbers case
      if (isNaN(newValue) || newValue.length >= 9) {
        newValue = parseFloat(2).toFixed(2);
      }

      input.value = newValue;
    }
  },

  // Reset the prices to original values
  handleReset: function (e) {
    e.preventDefault();

    Oci.prices = utils.cloneObject(Oci.origPrices);
    self.loadPrices();
  }
});

module.exports = prices;
