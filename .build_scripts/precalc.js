var fs = require('fs');
var utils = require('./utils');

global.Oci = {};
Oci.data = JSON.parse(fs.readFileSync('app/assets/data/oils.json'))
Oci.prices = JSON.parse(fs.readFileSync('app/assets/data/prices.json'))
Oci.data.info = JSON.parse(fs.readFileSync('app/assets/data/info.json'))
Oci.data.globalExtents = {}

var ratios = ['perBarrel', 'perMJ', 'perCurrent', 'perHistoric', 'perDollar'];
var minMaxes = ['min', 'max'];
var components = ['ghgTotal', 'total', 'downstream', 'upstream', 'midstream'];
var oils = Object.keys(Oci.data.info);

ratios.forEach(function (ratio) {
  minMaxes.forEach(function (minMax) {
    components.forEach(function (component) {
      oils.forEach(function (oil) {
        utils.getGlobalExtent(ratio, minMax, component, oil, true)
      })
      utils.getGlobalExtent(ratio, minMax, component, null, true)
    })
  })
})

fs.writeFileSync('app/assets/data/global-extents.json', JSON.stringify(Oci.data.globalExtents));
