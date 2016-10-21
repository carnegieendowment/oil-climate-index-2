var Backbone = require('backbone');

var Metadata = Backbone.Model.extend({
  url: 'assets/data/metadata.json'
});

module.exports = Metadata;
