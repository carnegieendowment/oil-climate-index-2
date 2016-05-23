var test = require('ava');
var utils = require('../app/assets/scripts/utils');

test('Category colors', function (t) {
  var range = ['#231F20', '#645A4F', '#006838', '#009444', '#8DC63F',
               '#003A63', '#EDCF0E', '#006AA7', '#CCC7C2', '#0095DA'];
  t.is(utils.categoryColorForType('Extra-Heavy'), range[0]);
  t.is(utils.categoryColorForType('Heavy'), range[1]);
  t.is(utils.categoryColorForType('Medium'), range[2]);
  t.is(utils.categoryColorForType('Light'), range[3]);
  t.is(utils.categoryColorForType('Ultra-Light'), range[4]);
  t.is(utils.categoryColorForType('Ultra-Deep'), range[5]);
  t.is(utils.categoryColorForType('Oil Sands'), range[6]);
  t.is(utils.categoryColorForType('Depleted'), range[7]);
  t.is(utils.categoryColorForType('Condensate'), range[8]);
  t.is(utils.categoryColorForType('High Gas'), range[9]);
  t.is(utils.categoryColorForType('test invalid'), '#ccc');
});
