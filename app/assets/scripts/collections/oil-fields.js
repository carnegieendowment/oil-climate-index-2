var Backbone = require('backbone');

var OilFields = Backbone.Model.extend({
  url: 'assets/data/oilfields.geojson'
});

module.exports = OilFields;
