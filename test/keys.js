var test = require('ava');
var fs = require('fs');

test('Data exists with five basic keys', function (t) {
  var oils = JSON.parse(fs.readFileSync('../app/assets/data/oils.json', 'utf8'));
  t.same(Object.keys(oils), ['info', 'opgee', 'prelim', 'metadata', 'lhv']);
});
