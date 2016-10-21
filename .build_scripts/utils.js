var $ = require('jquery');
var d3 = require('d3');
var _ = require('lodash');

var utils = {
  // Get global extents for dataset
  // send ratio, min/max
  // optional component and oil
  // store them and return so we only have to calculate once per session
  // separate option for running this out of browser (preCalc)
  getGlobalExtent: function (ratio, minMax, component, selectedOil, preCalc) {
    // handle this one input differently
    if (component === 'ghgTotal') {
      component = null;
    }

    // check if this already exists and return if so
    var oilLookup = selectedOil || 'global';
    var componentLookup = component || 'total';
    // special case for perDollar where we only return if the prices.json match
    if (Oci.data.globalExtents[ratio] &&
        Oci.data.globalExtents[ratio][oilLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax]) {
      if (!(ratio === 'perDollar' && !_.isEqual(Oci.prices, Oci.origPrices))) {
        return Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax];
      }
    }

    var data = Oci.data;

    // filter data if only one oil is selected
    var oils = data.info;
    if (selectedOil) {
      oils = _.zipObject([selectedOil], _.filter(oils, function (obj, key) { return key === selectedOil; }));
    }

    // figure out whether to calculate mins or maxs
    var minMaxMultiplier = (minMax === 'min') ? -1 : 1;
    var extent = null;

    // make a components object for easier summing later
    var components = {};

    // Loop
    for (var key in oils) {
      var opgeeExtent = null;
      var transport = +oils[key]['Transport Emissions'];  // Transport total
      for (var i = 0; i < data.metadata.solarSteam.split(',').length; i++) {
        for (var j = 0; j < data.metadata.water.split(',').length; j++) {
          for (var k = 0; k < data.metadata.flare.split(',').length; k++) {
            var opgee = data.opgee['run' + i + j + k][key];
            var extraction = +opgee['Net lifecycle emissions'];

            if (!opgeeExtent || (extraction * minMaxMultiplier > opgeeExtent * minMaxMultiplier)) {
              opgeeExtent = extraction;
            }
          }
        }
      }
      for (var l = 0; l < data.metadata.refinery.split(',').length; l++) {
        // this for loop is for LPG runs
        for (var m = 0; m < 2; m++) {
          var prelim = data.prelim['run' + l + m][key];
          // we might not have a prelim run for this oil (certain oils don't
          // run through some refineries)
          if (!prelim) break;

          [0, 0.5, 1].forEach(function (showCoke) {
            var refining = +utils.getRefiningTotal(prelim);
            var combustion = +utils.getCombustionTotal(prelim, showCoke, m);

            // Sum it up! (conditionally based on whether component is selected)
            var total;
            components.upstream = opgeeExtent;
            components.midstream = refining;
            components.downstream = combustion + transport;
            if (component) {
              total = components[component];
            } else {
              total = _.reduce(components, function (a, b) { return a + b; }, 0);
            }

            // Handle ratio
            total = utils.getValueForRatio(total, ratio, prelim, showCoke, data.info[key], m);

            // Check which is bigger (or smaller)
            if (!opgeeExtent || (extraction * minMaxMultiplier > opgeeExtent * minMaxMultiplier)) {
              opgeeExtent = extraction;
            }
            if (!extent || (total * minMaxMultiplier > extent * minMaxMultiplier)) {
              extent = total;
            }
          });
        }
      }
    }

    // store for later
    if (!Oci.data.globalExtents[ratio]) {
      Oci.data.globalExtents[ratio] = {};
    }
    if (!Oci.data.globalExtents[ratio][oilLookup]) {
      Oci.data.globalExtents[ratio][oilLookup] = {};
    }
    if (!Oci.data.globalExtents[ratio][oilLookup][componentLookup]) {
      Oci.data.globalExtents[ratio][oilLookup][componentLookup] = {};
    }
    Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax] = extent;
    return extent;
  },

  // Convert the original value to a new value based on desired ratio type
  getValueForRatio: function (originalValue, ratio, prelim, showCoke, info) {
    switch (ratio) {
      case 'perBarrel':
        return originalValue;
      case 'perMJ':
        // GHG/barrel * barrel/MJ * g/kg
        return originalValue * (1.0 / utils.getMJPerBarrel(prelim, showCoke, info)) * 1000;
      case 'perDollar':
        // GHG/barrel * barrel/$ * g/kg
        return originalValue * (1.0 / this.getPricePerBarrel(prelim, showCoke, info)) * 1000;
      case 'perCurrent':
        // GHG/barrel * barrel/currentPrice * g/kg
        return originalValue * (1.0 / info['Per $ Crude Oil - Current']) * 1000;
      case 'perHistoric':
        // GHG/barrel * barrel/historicPrice * g/kg
        return originalValue * (1.0 / info['Per $ Crude Oil - Historic']) * 1000;
      default:
        return originalValue;
    }
  },

  // Use prelim data and pricing info to determing blended price per barrel
  getPricePerBarrel: function (prelim, showCoke, info, historicSwitch) {
    var priceKey = historicSwitch ? 'historicPrice' : 'currentPrice';
    // if we don't have PRELIM barrels per day, use 100k as fallback
    var barrelsPerDay = Number(info['Barrels per day (PRELIM)']) || 100000;

    // Sum up price * portion in barrel
    var sum = prelim['Portion Gasoline'] * Oci.prices.gasoline[priceKey] +
      prelim['Portion Jet Fuel'] * Oci.prices.jetFuel[priceKey] +
      prelim['Portion Diesel'] * Oci.prices.diesel[priceKey] +
      prelim['Portion Fuel Oil'] * Oci.prices.fuelOil[priceKey] +
      prelim['Portion Residual Fuels'] * Oci.prices.residualFuels[priceKey] +
      prelim['Portion Surplus Refinery Fuel Gas (RFG)'] * Oci.prices.lightEnds[priceKey] +
      prelim['Portion Liquefied Petroleum Gases (LPG)'] * Oci.prices.lpg[priceKey];

    // Special conversion to get to per barrel
    // divide by PRELIM barrels per day but use 100k as fallback
    sum = sum * 42 / barrelsPerDay;

    // Add extra if we're including petcoke, formulas are provided by Carnegie
    sum += (showCoke * (((prelim['Portion Petroleum Coke'] / 5) * Oci.prices.coke[priceKey]) / barrelsPerDay));
    sum += (showCoke * info['Portion Net Upstream Petcoke'] * Oci.prices.coke[priceKey]);

    return sum;
  },

  // Use prelim data and pricing info to determing blended MJ per barrel
  getMJPerBarrel: function (prelim, showCoke, info) {
    var LPG = Boolean(Number(prelim['Portion Liquefied Petroleum Gases (LPG)']));
    // if we don't have PRELIM barrels per day, use 100k as fallback
    var barrelsPerDay = Number(info['Barrels per day (PRELIM)']) || 100000;

    // Sum up MJ per day for each product
    var sum = Number(prelim['MJD Gasoline']) + Number(prelim['MJD Jet Fuel']) +
      Number(prelim['MJD Diesel']) + Number(prelim['MJD Fuel Oil']) +
      Number(prelim['MJD Residual Fuels']) +
      Number(prelim['MJD Surplus Refinery Fuel Gas (RFG)']) +
      (LPG ? Number(prelim['MJD Liquefied Petroleum Gases (LPG)']) : 0);

    // Add extra if we're including petcoke, formulas are provided by Carnegie
    // use 31341.8 as fallback conversion factor
    sum += (showCoke * prelim['MJD Petroleum Coke']);
    sum += (showCoke * info['Portion Net Upstream Petcoke'] *
      (info['Net Upstream Petcoke Conversion'] || 31341.8) * barrelsPerDay);

    return sum / barrelsPerDay;
  },

  // Sum up combustion fields
  getCombustionTotal: function (prelim, showCoke) {
    var combustionArray = [prelim['Gasoline'], prelim['Jet Fuel'],
      prelim['Diesel'], prelim['Fuel Oil'], prelim['Residual Fuels'],
      prelim['Liquefied Petroleum Gas (LPG)']];

    if (showCoke) {
      combustionArray.push(prelim['Petroleum Coke'] * showCoke);
      combustionArray.push(prelim['Net Upstream Petcoke'] * showCoke);
    }

    return d3.sum(combustionArray);
  },

  // Sum up refining fields
  getRefiningTotal: function (prelim) {
    return prelim['Total refinery processes '];
  },

  // Trim metadata arrays
  trimMetadataArray: function (indices) {
    return indices.map(function (index) {
      return index.trim();
    });
  }
}

module.exports = utils;
