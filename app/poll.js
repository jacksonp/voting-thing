(function (exports) {
  'use strict';

  function isNumeric (n) {
    // see jquery.isNumeric implementation.
    return (n - parseFloat(n) + 1) >= 0;
  }

  exports.Poll = function (name, type, details) {

    // http://stackoverflow.com/a/10454560
    function decimalPlaces (num) {
      var match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
      if (!match) {
        return 0;
      }
      return Math.max(0,
        // Number of digits right of decimal point.
        (match[1] ? match[1].length : 0)
          // Adjust for scientific notation.
        - (match[2] ? +match[2] : 0));
    }

    if (!name) {
      throw 'Poll needs a Name.';
    }

    if (type === 'range') {
      if (!isNumeric(details.min)) {
        throw 'Min must be a number.';
      }
      if (!isNumeric(details.max)) {
        throw 'Max must be a number.';
      }
      if (!isNumeric(details.step)) {
        throw 'Step must be a number.';
      }
      if (details.min >= details.max) {
        throw 'Max must be more than Min.';
      }
      if (details.step > details.max - details.min) {
        throw 'Step is too large.';
      }
    }

    this.name = name;
    this.type = type;
    this.details = details;
    if (!this.details.decimals) {
      this.details.decimals = decimalPlaces(details.step);
    }
    this.votes = [];

  };

})(typeof exports === 'undefined' ? this['Poll'] = {} : exports);
