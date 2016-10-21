var Backbone = require('backbone');
var model = require('../models/opgee.js');

var Opgee = Backbone.Collection.extend({
  model: model
});

module.exports = Opgee;
