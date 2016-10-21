var Backbone = require('backbone');

var Prices = Backbone.Model.extend({
  url: 'assets/data/prices.json'
});

module.exports = Prices;
