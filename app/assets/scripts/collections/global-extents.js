var Backbone = require('backbone');

var GlobalExtents = Backbone.Model.extend({
  url: 'assets/data/global-extents.json'
});

module.exports = GlobalExtents;
