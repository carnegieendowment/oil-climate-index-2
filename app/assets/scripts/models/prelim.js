var Backbone = require('backbone');

var Prelim = Backbone.Model.extend({
  url: function () {
    return 'assets/data/prelim/prelim_' + this.id + '.json';
  }
});

module.exports = Prelim;
