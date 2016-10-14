var test = require('ava');
var fs = require('fs');

test('All JSON files should parse correctly', function (t) {
  var blurbs = fs.readFileSync('../app/assets/data/blurbs.json');
  var oilfields = fs.readFileSync('../app/assets/data/oilfields.geojson');
  var oils = fs.readFileSync('../app/assets/data/oils.json');
  var prices = fs.readFileSync('../app/assets/data/prices.json');
  var related = fs.readFileSync('../app/assets/data/related.json');
  [ blurbs, oilfields, oils, prices, related ].forEach(function (file) {
    t.notThrows(function () { JSON.parse(file); });
  });
});

test('Data should exist with four basic keys', function (t) {
  var oils = JSON.parse(fs.readFileSync('../app/assets/data/oils.json', 'utf8'));
  t.same(Object.keys(oils), ['info', 'opgee', 'prelim', 'metadata']);
});
