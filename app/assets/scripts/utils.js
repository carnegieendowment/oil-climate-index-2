/*global Oci*/
'use strict';

var $ = require('jquery');
var d3 = require('d3');
import _ from 'lodash';

var utils = {
  // Get global extents for dataset
  // send ratio, min/max
  // optional component and oil
  // store them and return so we only have to calculate once per session
  getGlobalExtent: function (ratio, minMax, component, selectedOil) {
    // handle this one input differently
    if (component === 'ghgTotal') {
      component = null;
    }

    // check if this already exists and return if so
    var oilLookup = selectedOil || 'global';
    var componentLookup = component || 'total';
    if (Oci.data.globalExtents[ratio] &&
        Oci.data.globalExtents[ratio][oilLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup] &&
        Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax]) {
      return Oci.data.globalExtents[ratio][oilLookup][componentLookup][minMax];
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

    // store for later (unless it's perDollar)
    if (['perDollar', 'perCurrent', 'perHistoric'].indexOf(ratio) === -1) {
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
    }
    return extent;
  },

  // Generate social sharing links
  generateSocialLinks: function (pageURL) {
    var summary = 'Explore the true cost of technological advancements across the complete oil supply chain.';
    var title = 'The Oil-Climate Index';

    // Twitter
    var twitter = 'https://twitter.com/share?' +
      'text=' + summary + '&' +
      'url=' + pageURL;

    // LinkedIn
    var linkedIn = 'http://www.linkedin.com/shareArticle?mini=true&' +
    'summary=' + summary + '&' +
    'title=' + title + '&' +
    'url=' + pageURL;

    // Mail
    var mail = 'mailto:?subject=' + title + '&' +
    'body=' + summary + '\n\n' + pageURL;

    return {
      twitter: twitter,
      linkedIn: linkedIn,
      mail: mail
    };
  },

  // Make a pretty oil name
  prettyOilName: function (oil) {
    return oil.Unique;
  },

  // Clone an object
  cloneObject: function (obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    var temp = obj.constructor(); // give temp the original obj's constructor
    for (var key in obj) {
      temp[key] = this.cloneObject(obj[key]);
    }

    return temp;
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
    // if we don't have PRELIM barrels per day, use 100k as fallback
    var barrelsPerDay = Number(info['Barrels per day (PRELIM)']) || 100000;

    // Sum up MJ per day for each product
    var sum = Number(prelim['MJD Gasoline']) + Number(prelim['MJD Jet Fuel']) +
      Number(prelim['MJD Diesel']) + Number(prelim['MJD Fuel Oil']) +
      Number(prelim['MJD Residual Fuels']) +
      Number(prelim['MJD Surplus Refinery Fuel Gas (RFG)']) +
      Number(prelim['MJD Liquefied Petroleum Gases (LPG)']);

    // Add extra if we're including petcoke, formulas are provided by Carnegie
    // use 31341.8 as fallback conversion factor
    sum += (showCoke * prelim['MJD Petroleum Coke']);
    sum += (showCoke * info['Portion Net Upstream Petcoke'] *
      (info['Net Upstream Petcoke Conversion'] || 31341.8) * barrelsPerDay);

    return sum / barrelsPerDay;
  },

  categoryColorForType: function (oilType) {
    var range = ['#231F20', '#645A4F', '#006838', '#009444', '#8DC63F',
                 '#003A63', '#EDCF0E', '#006AA7', '#CCC7C2', '#0095DA'];
    var colors = d3.scale.ordinal()
                   .domain(d3.range(9))
                   .range(range);
    switch (oilType) {
      case 'Extra-Heavy':
        return colors(0);
      case 'Heavy':
        return colors(1);
      case 'Medium':
        return colors(2);
      case 'Light':
        return colors(3);
      case 'Ultra-Light':
        return colors(4);
      case 'Ultra-Deep':
        return colors(5);
      case 'Oil Sands':
        return colors(6);
      case 'Depleted':
        return colors(7);
      case 'Condensate':
        return colors(8);
      case 'High Gas':
        return colors(9);
      default:
        console.warn('Invalid oil type for color', oilType);
        return '#ccc';
    }
  },

  // Build up a querystring from view parameters
  buildShareURLFromParameters: function (params) {
    if (!params || params === '') {
      return '';
    }

    var arr = [];
    for (var k in params) {
      arr.push(k + '=' + params[k]);
    }
    var qs;
    if (arr.length === 0) {
      qs = '';
    } else {
      qs = '?' + arr.join('&');
    }
    var hash = window.location.hash.split('?')[0];
    var path = window.location.pathname;
    var url = window.location.origin + path + hash + qs;

    return url;
  },

  // Build up a querystring from view parameters
  parseParametersFromShareURL: function (url) {
    if (!url || url === '') {
      return {};
    }

    var qs = url.split('?');
    if (qs.length !== 2) {
      return {};
    }

    var arr = qs[1].split('&');
    var params = {};
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i].split('=');
      if (item.length !== 2) {
        return {};
      }
      params[item[0]] = decodeURIComponent(item[1]).split(',');
    }

    return params;
  },

  // Send an oil name, get a unique ID
  makeId: function (unique) {
    return unique.toLowerCase().replace(/ /g, '-');
  },

  // Return a string with first letter uppercased
  capitalize: function (s) {
    if (!s) {
      return '';
    }

    return s[0].toUpperCase() + s.slice(1);
  },

  numberWithCommas: function (x) {
    if (typeof x === 'string') { x = Number(x.split(',').join('')); }

    // Always allow three significant digits
    var powerOfTen = x.toFixed(0).length - 1;
    var powerToRoundTo = Math.max(powerOfTen - 2, 0);
    var roundingFactor = Math.pow(10, powerToRoundTo);
    x = Math.round(x / roundingFactor) * roundingFactor;

    // Always round to nearest integer
    // This will also remove any decimals, which is intended
    x = String(Math.round(Number(x)));

    // Add commas
    x = x.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return x;
  },

  // Find and set option for an input or select field
  setInputFieldOption: function (inputField, options) {
    var inputElems = document.getElementsByName(inputField);
    if (inputElems[0].nodeName === 'INPUT' && (
      inputElems[0].type === 'radio' ||
      (inputElems.length > 1 && inputElems[0].type === 'checkbox')
    )) {
      for (var i = 0; i < inputElems.length; i++) {
        options.forEach(function (option) {
          if (inputElems[i].value === option) {
            inputElems[i].checked = true;
          }
        });
      }
    } else if (inputElems[0].nodeName === 'INPUT' && inputElems.length === 1 && inputElems[0].type === 'checkbox') {
      if (options[0] === 'on') {
        inputElems[0].checked = true;
      } else {
        inputElems[0].checked = false;
      }
    } else if (inputElems[0].nodeName === 'INPUT' && inputElems[0].type === 'text') {
      inputElems[0].value = options[0];
    } else if (inputElems[0].nodeName === 'SELECT') {
      var selectedOption = options[0];
      $('[name=' + inputField + ']').val(selectedOption);
    } else {
      console.warn('Unexpected element type found when setting input field');
    }
  },

  // Get dataset key for a given programmatic-friendly key
  getDatasetKey: function (key) {
    switch (key) {
      case 'apiGravity':
        return 'API (PRELIM)';
      case 'oilDepth':
        return 'Field Depth';
      case 'waterToOilRatio':
        return 'Water-to-Oil-Ratio';
      case 'gasToOilRatio':
        return 'Gas-to-Oil-Ratio';
      case 'ghgTotal':
        return 'Total Emissions';
      case 'transport':
        return 'Transport Emissions';
      case 'productionVolume':
        return 'Oil Production Volume';
      case 'sulfurContent':
        return 'Sulfur %wt (PRELIM)';
      case 'prodResidual':
        return 'Portion Residual Fuels';
      case 'prodGasoline':
        return 'Portion Gasoline';
      case 'prodDiesel':
        return 'Portion Diesel';
      case 'yearsProduction':
        return 'Field Age';

      case 'upstream':
        return 'Upstream Emissions';
      case 'midstream':
        return 'Midstream Emissions';
      case 'downstream':
        return 'Downstream Emissions';
      case 'steamToOilRatio':
        return 'Steam-to-Oil-Ratio';
      case 'flaringToOilRatio':
        return 'Flaring-to-Oil-Ratio';
      case 'prodLPG':
        return 'Portion Liquefied Petroleum Gases (LPG)';
      case 'prodJet':
        return 'Portion Jet Fuel';
      case 'prodPetcoke':
        return 'Portion Petroleum Coke';
      case 'prodUpstreamPetcoke':
        return 'Portion Net Upstream Petcoke';
      case 'currentMarketValue':
        return 'Current Market Value';
      case 'historicMarketValue':
        return 'Historic Market Value';

      default:
        return console.warn('Unknown key ' + key);
    }
  },

  // Get units for name
  getUnits: function (key, sortRatio) {
    var getGHGUnits = function (sortRatio) {
      switch (sortRatio) {
        case 'perBarrel':
          return 'kg CO\u2082 eq./barrel crude';
        case 'perMJ':
          return 'g CO\u2082 eq./MJ products';
        case 'perCurrent':
          return 'g CO\u2082 eq./$ crude';
        case 'perHistoric':
          return 'g CO\u2082 eq./$ crude';
        case 'perDollar':
          return 'g CO\u2082 eq./$ products';
        default:
          console.warn('unknown sort ratio');
          return '';
      }
    };

    switch (key) {
      case 'apiGravity':
        return 'deg API';
      case 'oilDepth':
        return 'feet';
      case 'waterToOilRatio':
        return 'bbl water/bbl crude';
      case 'gasToOilRatio':
      case 'flaringToOilRatio':
        return 'scf/bbl crude';
      case 'steamToOilRatio':
        return 'bbl steam/bbl oil';
      case 'productionVolume':
        return 'barrels per day';
      case 'emissionRate':
        return 'million metric tons CO<sub>2</sub> eq./year';
      case 'yearsProduction':
        return 'Years';
      case 'sulfurContent':
        return '% weight';
      case 'flaring':
        return 'billion cubic meters/year';
      case 'prodGasoline':
      case 'prodDiesel':
      case 'prodResidual':
      case 'prodLPG':
      case 'prodJet':
      case 'prodPetcoke':
        return 'bbl product/100,000 bbl crude';
      case 'type':
      case 'ghgTotal':
      case 'upstream':
      case 'midstream':
      case 'downstream':
        return getGHGUnits(sortRatio);
      case 'currentMarketValue':
      case 'historicMarketValue':
      case 'ghgPrice':
        return '$ products/bbl crude';
      default:
        console.warn('unknown key (' + key + ')');
        return '';
    }
  },

  // Get a nice name for a key, with a special case for Emissions Drivers
  getDatasetName: function (key, sortRatio, isDrivers) {
    var addRatioString = function (title, sortRatio) {
      if (!sortRatio) {
        return title;
      }

      switch (sortRatio) {
        case 'perBarrel':
          title += '';
          break;
        case 'perMJ':
          title += ' Per Megajoule';
          break;
        case 'perCurrent':
          title += ' Per Current Crude Value';
          break;
        case 'perHistoric':
          title += ' Per Historic Crude Value';
          break;
        case 'perDollar':
          title += ' Per Dollar';
          break;
        default:
          console.warn('Unknown sort ratio');
          break;
      }
      return title;
    };
    switch (key) {
      case 'apiGravity':
        return 'API Gravity';
      case 'oilDepth':
        return 'Field Depth';
      case 'waterToOilRatio':
        return 'Water-to-Oil Ratio';
      case 'gasToOilRatio':
        return 'Gas-to-Oil Ratio';
      case 'productionVolume':
        return 'Current Estimated Oil Production';
      case 'prodGasoline':
        return 'Gasoline Production';
      case 'prodDiesel':
        return 'Diesel Production';
      case 'prodResidual':
        return 'Residual Fuels Production';
      case 'yearsProduction':
        return 'Years in Production';
      case 'sulfurContent':
        return 'Sulfur Content';
      case 'type':
      case 'ghgTotal':
      case 'midstream':
      case 'upstream':
      case 'downstream':
        if (isDrivers === true && key !== 'ghgTotal') {
          return addRatioString(key + ' Greenhouse Gas Emissions', sortRatio);
        } else {
          return addRatioString('Total Greenhouse Gas Emissions', sortRatio);
        }

      case 'steamToOilRatio':
        return 'Steam-to-Oil Ratio';
      case 'flaringToOilRatio':
        return 'Flaring-to-Oil Ratio';
      case 'prodLPG':
        return 'Liquefied Petroluem Gas (LPG) Production';
      case 'prodJet':
        return 'Jet Fuel Production';
      case 'prodPetcoke':
        return 'Petroleum Coke Production';
      case 'currentMarketValue':
        return 'Current Market Value';
      case 'historicMarketValue':
        return 'Historic Market Value';

      default:
        console.warn('Unknown key');
        return '';
    }
  },

  // Type insensitive indexOf
  indexInArray: function (array, value) {
    var index = -1;
    for (var i = 0; i < array.length; i++) {
      // TODO: find out how this is called a make this ===
      if (array[i] == value) { // eslint-disable-line
        index = i;
        break;
      }
    }

    return index;
  },

  // Get the current OPGEE model based on model parameters
  getOPGEEModel: function (solarSteam, water, flaring) {
    var metadata = Oci.data.metadata;
    var si = this.indexInArray(this.trimMetadataArray(metadata.solarSteam.split(',')), solarSteam);
    var wi = this.indexInArray(this.trimMetadataArray(metadata.water.split(',')), water);
    var fi = this.indexInArray(this.trimMetadataArray(metadata.flare.split(',')), flaring);

    // Generate model string
    var model = 'run';
    // If we don't have a match, return default
    if (si === -1 || wi === -1 || fi === -1) {
      model += '000';
    } else {
      model += [si, wi, fi].join('');
    }
    return model;
  },

  // Get the current PRELIM model
  getPRELIMModel: function (refinery, lpg) {
    var metadata = Oci.data.metadata;
    var ri = this.trimMetadataArray(metadata.refinery.split(',')).indexOf(refinery);
    var li = 1 - Number(lpg);
    // Generate model string
    var model = 'run';
    // If we don't have a match, return default
    if (ri === -1) {
      model += ('0' + li);
    } else {
      model = model + ri + li;
    }
    return model;
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

  // Return combustion components
  getDownstreamComponents: function (prelim, showCoke, transport) {
    var outList = ['Heat', 'Steam', 'Electricity', 'Hydrogen', 'Fluid',
      'Excess', 'Portion', 'Total', 'Unique', 'MJperbbl', 'MJD'];

    var objArray = _.filter(_.map(prelim, function (el, key) {
      return { name: key, value: el };
    }), function (el) {
      return ['Petroleum Coke', 'Net Upstream Petcoke'].indexOf(el.name) === -1;
    });

    // add a combined petcoke object
    if (showCoke) {
      objArray.push({
        name: 'Petroleum Coke',
        value: (Number(prelim['Petroleum Coke']) * showCoke || 0) + (Number(prelim['Net Upstream Petcoke']) * showCoke || 0)
      });
    }

    // Add transport since we're combining it and combustion for downstream
    objArray.push({ name: 'Transport to Consumers', value: transport });
    var unsorted = _.filter(objArray, function (el) {
      return outList.indexOf(el.name.split(' ')[0]) === -1 &&
        Number(el.value) > 0.005;
    });
    return this.preorderedSort(unsorted, 'downstream');
  },

  // Return refining components
  getRefiningComponents: function (prelim) {
    var refining = [
      {
        name: 'Heat',
        value: this.aggregatePrelim(prelim, 'Heat')
      },
      {
        name: 'Electricity',
        value: +prelim['Electricity']
      },
      {
        name: 'Steam',
        value: this.aggregatePrelim(prelim, 'Steam')
      },
      {
        name: 'Hydrogen (via Steam Methane Reformer)',
        value: this.aggregatePrelim(prelim, 'Hydrogen')
      },
      {
        name: 'Catalyst Regeneration (Fluid Catalytic Cracking)',
        value: +prelim['Fluid Catalytic Cracking Regeneration']
      }
    ];
    return _.filter(refining, function (el) {
      return el.value > 0.005;
    });
  },

  // Return extraction components
  getExtractionComponents: function (opgee) {
    var outList = ['Water-to-Oil-Ratio', 'Net', 'API', 'Gas-to-Oil-Ratio', 'Unique', 'Flaring-to-Oil-Ratio', 'Steam-to-Oil-Ratio'];
    var objArray = _.map(opgee, function (el, key) {
      return {
        name: key,
        value: el
      };
    });
    var unsorted = _.filter(objArray, function (el) {
      return outList.indexOf(el.name.split(' ')[0]) === -1 &&
        Number(el.value).toFixed(0) !== '0';
    });
    return this.preorderedSort(unsorted, 'upstream');
  },

  // Aggregates prelim components according to a string
  // String matches against first word of prelim properties
  aggregatePrelim: function (prelim, string) {
    return _.reduce(prelim, function (a, b, key) {
      return a + ((key.split(' ')[0] === string) ? Number(b) : 0);
    }, 0);
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
  },

  // Create the tooltip html given a title, a type, an array
  // of values like [{name: foo, value: 12, units: bbl}, {name: bar, value: 123, units: bbl}],
  // an oil name, and a link
  createTooltipHtml: function (title, type, values, link, text, icons, showCarbon, zoom, dataQuality, extraThousander) {
    var valuesString = '';
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      valuesString += '<dt>' + v.name + '<small class="units">' + v.units + '</small></dt>';
      if (showCarbon) {
        // extraThousander handles conversion of grams to kgs for certain ratios
        valuesString += '<dd class="value-oil-detail">$' +
          (Math.round(v.value / (1000 * (extraThousander ? 1000 : 1)) * Oci.carbonTax * 20) / 20)
          .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '</dd>';
      } else {
        valuesString += '<dd class="value-oil-detail">' + this.numberWithCommas(v.value) + '</dd>';
      }
    }
    var iconString = '';
    if (icons) {
      iconString = '<div class="card-details-drivers"><h6>Emissions Drivers:</h6>' +
        '<ul>' + icons.split(',').filter(function (f) {
          return f.trim();
        }).map(function (m, i, arr) {
          return '<li>' + m;
        }).join(',</li>') + '</li></ul></div>';
    }
    var zoomString = (zoom)
    ? '<a  title="Zoom to Field" class="zoom-field button button-small button-tertiary ' + link + '">Zoom to Field</a>'
    : '';
    var html = '<div class="popover top in popover-main">' +
      '<div class="popover-inner">' +
        '<div class="popover-header">' +
          '<p class="popover-meta oil-type"><span><span class="swatch" style="background-color:' + this.categoryColorForType(type) + '"></span>' + type + '</span></p>' +
          '<h3 class="popover-title">' + title + '</h3>' +
          (text ? '<p class="description">' + text + '</p>' : '') +
          iconString +
        '</div>' +
        '<div class="popover-body clearfix">' +
          '<dl class="stats-list">' +
          valuesString +
          '</dl>' +
        '</div>' +
        '<div class="popover-footer">' +
          (dataQuality ? '<span class="data-quality units-description">Data Quality: ' + dataQuality + '</span>' : '') +
          '<a href="#oil/' + link + '" title="View oil profile" class="button button-small button-tertiary button-tertiary_arrow">View details</a>' +
          zoomString +
        '</div>' +
      '</div>' +
    '</div>';

    return html;
  },

  // send x and y coordinates
  // returns a boolean to determine if they are inside the tooltip
  // a bit of buffer on left and bottom for arrows and such
  insideTooltip: function (x, y) {
    var box = $('.d3-tip')[0].getBoundingClientRect();
    return (x > box.left - 30 && x < box.right && y < box.bottom + 30 && y > box.top);
  },

  preorderedSort: function (array, step) {
    return _.sortBy(array, function (sort) {
      return Oci.order[step].indexOf(sort.name);
    });
  },

  refineryNameToDropdown: function (refinery) {
    var dropdown;
    switch (refinery) {
      case 'Hydroskimming Configuration':
        dropdown = 1;
        break;
      case 'Medium Conversion: FCC & GO-HC ':
        dropdown = 2;
        break;
      case 'Deep Conversion: FCC & GO-HC':
        dropdown = 3;
        break;
    }
    return dropdown;
  },

  // https://clipboardjs.com/assets/scripts/tooltips.js
  fallbackMessage: function (action) {
    var actionMsg = '';
    var actionKey = (action === 'cut' ? 'X' : 'C');
    if (/iPhone|iPad/i.test(navigator.userAgent)) {
      actionMsg = 'No support :(';
    } else if (/Mac/i.test(navigator.userAgent)) {
      actionMsg = 'Press ⌘-' + actionKey + ' to ' + action;
    } else {
      actionMsg = 'Press Ctrl-' + actionKey + ' to ' + action;
    }
    return actionMsg;
  },

  getOilfield: function (unique) {
    // argument is an Oci.data.info property key
    var oil = Oci.data.info[unique];
    var oilFieldName = oil['Oil Field Name (OPGEE)'];
    if (oilFieldName.match('Bakken')) {
      oilFieldName = 'Bakken';
    }
    return _.find(Oci.oilfields.features, function (feature) {
      return oilFieldName === feature.properties.Field_Name;
    });
  },

  generateOilInfo: function (oilKey) {
    // Get the oil info
    var oil = Oci.data.info[oilKey];

    if (!oil) {
      // If we're here, something went wrong
      console.warn('Unable to find oil for id:', oilKey);
    }

    var makeCategoryTitle = function (sulfur) {
      return 'Sulfur: ' + parseFloat(sulfur).toFixed(2) + '%';
    };

    var makeDepthTitle = function (depth) {
      return parseInt(depth) + ' feet | ' + parseInt(depth * 0.3048) + ' meters';
    };

    // Create return object
    var obj = {
      name: utils.prettyOilName(oil),
      Unique: oil.Unique,
      keyStats: [
        {
          key: 'Oil Type',
          value: oil['Overall Crude Category']
        },
        {
          key: 'API Gravity',
          value: Math.round(Number(oil['API (PRELIM)']))
        },
        {
          key: 'Location',
          value: oil['Onshore/Offshore']
        },
        {
          key: 'Sulfur Content',
          value: oil['Sulfur Category'],
          'data-title': makeCategoryTitle(oil['Sulfur %wt (PRELIM)'])
        },
        {
          key: 'Depth',
          value: oil['Shallow; Deep; Ultra-Deep']
        },
        {
          key: 'Production Volume',
          value: oil['Production Volume']
        },
        {
          key: 'Flare Rate',
          value: oil['Flaring Class']
        }, {
          key: 'Water Content',
          value: oil['Watery Oil']
        }, {
          key: 'Gas Content',
          value: oil['Gassy Oil']
        }, {
          key: 'Default Refinery Configuration',
          value: oil['Default Refinery']
        }, {
          key: 'Data Quality',
          value: utils.getDataQuality(oil.Unique).total + '*',
          'data-title': utils.printDataQualityComponents(utils.getDataQuality(oil.Unique))
        }
      ]
    };
    if (Oci.blurbs[oil['Overall Crude Category']]) {
      obj.keyStats[0]['data-title'] = Oci.blurbs[oil['Overall Crude Category']].description;
    }
    if (oil['Field Depth']) {
      obj.keyStats[4]['data-title'] = makeDepthTitle(oil['Field Depth']);
    }
    // add asterisks for methodology/glossary note
    obj.keyStats[6].value += '*';
    obj.keyStats[7].value += '*';
    obj.keyStats[8].value += '*';
    return obj;
  },

  // Generates an oil object for plotting, potentially using default values
  generateOilObject: function (oilKey, modelData, showCoke, isComparison) {
    // if the oil key is a group instead of an oil...
    if (Object.keys(Oci.data.info).indexOf(oilKey) === -1) {
      // gather all matching oils
      var matchingLength;
      var sumObject = _.filter(Oci.data.info, function (oil) {
        return oil['Region'] === utils.groupIDtoName(oilKey) ||
          oil['Overall Crude Category'] === utils.groupIDtoName(oilKey);
      // generate objects for them
      }).map(function (oil, key, arr) {
        matchingLength = arr.length;
        return utils.generateOilObject(oil.Unique, modelData, showCoke, isComparison);
      // sum + average
      }).reduce(function (a, b) {
        return {
          'isComparison': isComparison,
          'id': oilKey,
          'name': utils.capitalize(oilKey),
          'apiGravity': a.apiGravity + b.apiGravity,
          'oilDepth': a.oilDepth + b.oilDepth,
          'ghgTotal': a.ghgTotal + b.ghgTotal,
          'upstream': a.upstream + b.upstream,
          'midstream': a.midstream + b.midstream,
          'downstream': a.downstream + b.downstream,
          'waterToOilRatio': a.waterToOilRatio + b.waterToOilRatio,
          'gasToOilRatio': a.gasToOilRatio + b.gasToOilRatio,
          'type': 'aggregated',
          'components': {
            'downstream': utils.arrayObjSum(a.components.downstream, b.components.downstream),
            'midstream': utils.arrayObjSum(a.components.midstream, b.components.midstream),
            'upstream': utils.arrayObjSum(a.components.upstream, b.components.upstream)
          }
        };
      });
      return {
        'isComparison': sumObject.isComparison,
        'id': sumObject.id,
        'name': sumObject.name,
        'apiGravity': sumObject.apiGravity / matchingLength,
        'oilDepth': sumObject.oilDepth / matchingLength,
        'ghgTotal': sumObject.ghgTotal / matchingLength,
        'upstream': sumObject.upstream / matchingLength,
        'midstream': sumObject.midstream / matchingLength,
        'downstream': sumObject.downstream / matchingLength,
        'waterToOilRatio': sumObject.waterToOilRatio / matchingLength,
        'gasToOilRatio': sumObject.gasToOilRatio / matchingLength,
        'type': sumObject.type,
        'components': {
          'downstream': utils.arrayObjDiv(sumObject.components.downstream, matchingLength),
          'midstream': utils.arrayObjDiv(sumObject.components.midstream, matchingLength),
          'upstream': utils.arrayObjDiv(sumObject.components.upstream, matchingLength)
        }
      };
    } else {
      // Get basic properties from model data
      var info = modelData.info[oilKey];
      var opgee = modelData.opgee[oilKey];
      var prelim = modelData.prelim[oilKey];
      var upstream = +opgee['Net lifecycle emissions'];
      var midstream = +utils.getRefiningTotal(prelim);
      var transport = +info[utils.getDatasetKey('transport')];
      var combustion = +utils.getCombustionTotal(prelim, showCoke);

      // Sum up for total
      var ghgTotal = d3.sum([upstream, midstream, transport, combustion]);

      // Create oil object
      return {
        'isComparison': isComparison,
        'id': utils.makeId(info.Unique),
        'name': utils.prettyOilName(info),
        'apiGravity': +info[utils.getDatasetKey('apiGravity')],
        'oilDepth': +info[utils.getDatasetKey('oilDepth')],
        'ghgTotal': ghgTotal,
        'upstream': upstream,
        'midstream': midstream,
        'downstream': combustion + transport,
        'waterToOilRatio': +opgee[utils.getDatasetKey('waterToOilRatio')],
        'gasToOilRatio': +opgee[utils.getDatasetKey('gasToOilRatio')],
        'type': info['Overall Crude Category'].trim(),
        'components': {
          'downstream': utils.getDownstreamComponents(prelim, showCoke, transport),
          'midstream': utils.getRefiningComponents(prelim),
          'upstream': utils.getExtractionComponents(opgee)
        }
      };
    }
  },

  groupIDtoName: function (id) {
    // Find the group name from the id
    for (var i = 0; i < Oci.regions.concat(Oci.types).length; i++) {
      if (utils.makeId(Oci.regions.concat(Oci.types)[i]) === id) {
        return Oci.regions.concat(Oci.types)[i];
      }
    }
  },

  arrayObjSum: function (array, array2) {
    // make a list of all possible keys in case the arrays have different ones
    var possibleKeys = _.uniq(_.map(array, 'name').concat(_.map(array2, 'name')));
    return possibleKeys.map(function (key) {
      var arrayMatch = array.filter(function (a) { return a.name === key; });
      var array2Match = array2.filter(function (a) { return a.name === key; });
      return {
        name: key,
        value: (arrayMatch.length ? Number(arrayMatch[0].value) : 0) +
          (array2Match.length ? Number(array2Match[0].value) : 0)
      };
    });
  },

  arrayObjDiv: function (array, divisor) {
    return array.map(function (a) {
      return {
        name: a.name,
        value: a.value / divisor
      };
    });
  },

  scrollToElementWithID: function (elementID) {
    $('html, body').animate({
      scrollTop: $('#' + elementID).offset().top - 66
    }, 1000);

    // Then scroll down slightly to make the OCI navbar smaller
    $('html, body').animate({
      scrollTop: $('#' + elementID).offset().top - 65
    }, 1);
  },

  getDataQuality: function (key) {
    function numberToQuality (num) {
      if (num > 2.5) {
        return 'High';
      } else if (num > 1.85) {
        return 'Medium';
      } else if (num > 0) {
        return 'Low';
      } else {
        return 'N/A';
      }
    }
    var oil = Oci.data.info[key];
    var upstreamQuality = +oil['OPGEE Data Quality'];
    var midstreamQuality = +oil['PRELIM Data Quality'];
    var downstreamQuality = +oil['OPEM Data Quality'];
    return {
      total: numberToQuality(((upstreamQuality || 0) + (midstreamQuality || 0) + (downstreamQuality || 0)) /
      ((upstreamQuality ? 1 : 0) + (midstreamQuality ? 1 : 0) + (downstreamQuality ? 1 : 0))),
      upstream: numberToQuality(upstreamQuality),
      midstream: numberToQuality(midstreamQuality),
      downstream: numberToQuality(downstreamQuality)
    };
  },

  printDataQualityComponents: function (obj) {
    return _.map(obj, function (value, key) {
      if (key === 'total') {
        return '';
      } else {
        return utils.capitalize(key) + ': ' + utils.capitalize(value);
      }
    }).filter(function (str) {
      return str;
    }).join(', ');
  }
};

module.exports = utils;
