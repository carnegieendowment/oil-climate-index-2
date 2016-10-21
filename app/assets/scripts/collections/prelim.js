var Backbone = require('backbone');
var model = require('../models/prelim.js');

var Prelim = Backbone.Collection.extend({
  model: model
});

module.exports = Prelim;
