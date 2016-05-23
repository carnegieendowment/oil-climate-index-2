var map = [
  { x: 0.2, y: 0.2, r: 5, g: 30 },
  { x: 0.8, y: 0.3, r: 3, g: 25 },
  { x: 0.6, y: 0.8, r: 8, g: 32 },
  { x: 0.65, y: 0.4, r: 10, g: 20 },
  { x: 0.7, y: 0.5, r: 4, g: 30 },
  { x: 0.71, y: 0.4, r: 3, g: 72 },
  { x: 0.6, y: 0.6, r: 2, g: 20 },
  { x: 0.76, y: 0.43, r: 4, g: 10 },
  { x: 0.5, y: 0.5, r: 4, g: 10 },
  { x: 0.75, y: 0.5, r: 3, g: 18 },
  { x: 0.6, y: 0.8, r: 2, g: 20 },
  { x: 0.58, y: 0.75, r: 6, g: 40 },
  { x: 0.22, y: 0.9, r: 4, g: 30 }
];
var productionGraph = [
  { p: 12, g: 60, type: 'Ultra-Light' },
  { p: 15, g: 71, type: 'Medium' },
  { p: 23, g: 73, type: 'Medium' },
  { p: 60, g: 77, type: 'Ultra-Light' },
  { p: 23, g: 81, type: 'Ultra-Light' },
  { p: 35, g: 82, type: 'Light' },
  { p: 15, g: 85, type: 'Medium' },
  { p: 40, g: 90, type: 'Condensate' },
  { p: 25, g: 105, type: 'Ultra-Deep' },
  { p: 25, g: 110, type: 'Light' },
  { p: 20, g: 110, type: 'Ultra-Deep' },
  { p: 33, g: 120, type: 'Medium' }
];
var supplyChain = [
  [
    { g: 60, type: 'Ultra-Light', x: 'oil1', y: 30 },
    { g: 73, type: 'Light', x: 'oil2', y: 40 },
    { g: 77, type: 'Medium', x: 'oil3', y: 25 },
    { g: 81, type: 'Ultra-Light', x: 'oil4', y: 60 },
    { g: 105, type: 'Ultra-Deep', x: 'oil5', y: 65 },
    { g: 110, type: 'Extra-Heavy', x: 'oil6', y: 78 },
    { g: 110, type: 'Ultra-Deep', x: 'oil7', y: 80 },
    { g: 120, type: 'Heavy', x: 'oil8', y: 72 }
  ],
  [
    { g: 60, type: 'Ultra-Light', x: 'oil1', y: 20 },
    { g: 73, type: 'Light', x: 'oil2', y: 19 },
    { g: 77, type: 'Medium', x: 'oil3', y: 18 },
    { g: 81, type: 'Ultra-Light', x: 'oil4', y: 12 },
    { g: 105, type: 'Ultra-Deep', x: 'oil5', y: 25 },
    { g: 110, type: 'Extra-Heavy', x: 'oil6', y: 30 },
    { g: 110, type: 'Ultra-Deep', x: 'oil7', y: 20 },
    { g: 120, type: 'Heavy', x: 'oil8', y: 10 }
  ],
  [
    { g: 60, type: 'Ultra-Light', x: 'oil1', y: 10 },
    { g: 73, type: 'Light', x: 'oil2', y: 14 },
    { g: 77, type: 'Medium', x: 'oil3', y: 34 },
    { g: 81, type: 'Ultra-Light', x: 'oil4', y: 9 },
    { g: 105, type: 'Ultra-Deep', x: 'oil5', y: 15 },
    { g: 110, type: 'Extra-Heavy', x: 'oil6', y: 2 },
    { g: 110, type: 'Ultra-Deep', x: 'oil7', y: 10 },
    { g: 120, type: 'Heavy', x: 'oil8', y: 38 }
  ]
];

var oilAttributes = productionGraph.map(function (d) {
  return {
    p: d.p,
    g: d.g,
    type: d.type,
    x: d.p * d.g % 43,
    xAlt: d.p * d.g % 47
  };
});

module.exports = {
  map: map,
  productionGraph: productionGraph,
  supplyChain: supplyChain,
  oilAttributes: oilAttributes
};
