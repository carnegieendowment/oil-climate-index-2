/*global Oci */
'use strict';
var Backbone = require('backbone');
var d3 = require('d3');
var $ = require('jquery');
window.$ = $;
var utils = require('../utils');

var BaseView = Backbone.View.extend({

  _windowSizing: function () {
    var self = this;
    $(window).on('resize', function () {
      if (window.orientation === undefined) {
        self._handleResize(self.resizeOptions);
      }
    });
    $(window).on('orientationchange', function () {
      setTimeout(function () {
        self._handleResize(self.resizeOptions);
      }, 500);
    });
  },

  _parseURLAndSetState: function () {
    // Handle any parameters we're interested in catching here
    var params = utils.parseParametersFromShareURL(window.location.href);

    // check if any parsed parameters match the views "shareParams" and then set
    // inputs accordingly
    var shareParams = this.shareParams || [];
    shareParams.forEach(function (p) {
      if (params[p.name]) {
        utils.setInputFieldOption(p.input, params[p.name]);
      }
    });

    // Set model parameters
    if (params.opgee || params.prelim || params.showCoke) {
      // Since the parameters are now treated as lists, just grab the first (and only) element
      params.opgee = params.opgee[0];
      params.prelim = params.prelim[0];
      params.showCoke = params.showCoke[0];
      this.modelParametersView.setModelParameters(params);
    }
  },

  _handleResize: function (resizeOptions) {
    if (!resizeOptions || resizeOptions.width) {
      this.width = $(this.chartElement).width() - this.margin.left - this.margin.right;
    }
    if (!resizeOptions || resizeOptions.height) {
      this.height = Math.round(this.width / this.aspectRatio);
    }
    // Clear anything in the svg element since we're going to rewrite
    d3.select(this.chartElement + ' svg').remove();
    this.chartInit();
  },

  _showPrices: function (e) {
    e.preventDefault();
    Oci.showPricesModal(true);
  },

  _setupShare: function () {
    var url = this._updateShareUrl();
    var pageURL = encodeURIComponent(utils.buildShareURLFromParameters({}));
    var links = utils.generateSocialLinks(pageURL);
    this._updateCopyLink(pageURL);

    // Twitter share
    $('li.twitter a').attr('href', links.twitter);

    // Facebook handled by meta tags

    // LinkedIn
    $('li.linkedin a').attr('href', links.linkedIn);

    // Mail
    $('li.email a').attr('href', links.mail);

    // Readonly input field
    $('#share-copy').attr('value', url);
  },

  _updateShareUrl: function () {
    // Don't overwrite the share URL until the querystring has been fully loaded into the window!
    if (this.hasShareLinkBeenParsed === false) { return window.location.href; }

    var baseObj = {};
    var shareParams = this.shareParams || [];
    if (this.modelParametersView) {
      var params = this.modelParametersView.getModelValues();
      baseObj = {
        opgee: utils.getOPGEEModel(params.solarSteam, params.water, params.flaring),
        prelim: utils.getPRELIMModel(params.refinery, params.lpg),
        showCoke: params.showCoke
      };
    }
    // Do the opposite of `utils.setInputFieldOption`
    var selected;
    shareParams.forEach(function (p) {
      selected = [];
      var inputElems = document.getElementsByName(p.input);
      if (inputElems[0].nodeName === 'INPUT' && (
        inputElems[0].type === 'radio' ||
        (inputElems.length > 1 && inputElems[0].type === 'checkbox')
      )) {
        for (var i = 0; i < inputElems.length; i++) {
          if ($(inputElems[i]).is(':checked')) {
            selected.push(encodeURIComponent(inputElems[i].value));
          }
        }
        if (selected.length > 0) {
          baseObj[p.name] = selected.join(',');
        }
      } else if (inputElems[0].nodeName === 'INPUT' && inputElems.length === 1 && inputElems[0].type === 'checkbox') {
        baseObj[p.name] = (inputElems[0].checked ? 'on' : 'off');
      } else if (inputElems[0].nodeName === 'INPUT' && inputElems[0].type === 'text') {
        baseObj[p.name] = inputElems[0].value;
      } else if (inputElems[0].nodeName === 'SELECT') {
        selected = $('[name=' + p.input + ']').find(':selected').val();
        baseObj[p.name] = selected;
      }
    });
    return utils.buildShareURLFromParameters(baseObj);
  },

  _updateCopyLink: function () {
    var shareURL = this._updateShareUrl();
    $('li.copylink').attr('data-clipboard-text', shareURL);
    window.history.replaceState(null, null, shareURL);
  },

  _activateSearchBar: function () {
    var oilNames = [];
    Object.keys(Oci.data.info || {}).forEach(function (oilName) {
      oilNames.push(Oci.data.info[oilName].Unique);
    });

    var CHARACTER_LIMIT = 1;
    $('.component-search input').on('input', function () {
      // Determine which oils match the partially-typed name
      var search = $(this).val();
      var re = new RegExp(search, 'i');
      var matchedNames = oilNames.filter(function (oilName) {
        return (
          search.length >= CHARACTER_LIMIT &&
          oilName.search(re) > -1
        );
      });

      // Create and insert the HTML
      var resultsHTML = matchedNames.map(function (oilName) {
        var oilID = utils.makeId(oilName);
        return '<div class="search-result"><a href="#oil/' + oilID + '">' + oilName + '</a></div>';
      }).join('');
      $(this).parent().find('.search-results').html(resultsHTML);
    });

    $('.component-search input').on('keyup', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var $container = $(this).parent().find('.search-results');
      var $results = $(this).parent().find('.search-result');
      var $previous, $next, $newActive;
      var oneActive = $results.hasClass('active');
      var $active = $results.parent().find('.active');

      if ($container.html()) {
        switch (e.keyCode) {
          case 38: // up
            if (oneActive) {
              $active.removeClass('active');
              $previous = $active.prev();
              // if a previous element exists, that becomes active, otherwise
              // go to the end
              // make sure our active result stays in view
              if ($previous.length) {
                $newActive = $previous.addClass('active');
                if ($newActive.position().top < 0) {
                  $container.scrollTop($container.scrollTop() - $newActive.outerHeight());
                }
              } else {
                $results.last().addClass('active');
                $container.scrollTop($container[0].scrollHeight);
              }
            } else {
              $results.last().addClass('active');
              $container.scrollTop($container[0].scrollHeight);
            }
            break;
          case 40: // down
            if (oneActive) {
              $active.removeClass('active');
              $next = $active.next();
              // if a next element exists, that becomes active, otherwise start
              // at the beginning
              // make sure our active result stays in view
              if ($next.length) {
                $newActive = $next.addClass('active');
                if ($newActive.position().top + $newActive.outerHeight() > $container.outerHeight()) {
                  $container.scrollTop($container.scrollTop() + $newActive.outerHeight());
                }
              } else {
                $results.first().addClass('active');
                $container.scrollTop(0);
              }
            } else {
              $results.first().addClass('active');
            }
            break;
          case 13: // enter/return
            if ($results.hasClass('active')) {
              Oci.router.navigate($active.find('a').attr('href'), {trigger: true});
            }
            break;
        }
      }
    });
  }
});

module.exports = BaseView;
