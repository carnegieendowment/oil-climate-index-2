var Backbone = require('backbone');

var Blurbs = Backbone.Model.extend({
  url: 'assets/data/blurbs.json'
});

module.exports = Blurbs;
