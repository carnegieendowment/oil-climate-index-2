var Backbone = require('backbone');

var Opgee = Backbone.Model.extend({
  url: function () {
    return 'assets/data/opgee/opgee_' + this.id + '.json';
  }
});

module.exports = Opgee;
