'use strict';

var uuid = require('node-uuid');

var Poll = function (name, min, max, step) {
  this.name = name;
  this.min = min;
  this.max = max;
  this.step = step;
  this.decimals = decimalPlaces(step);
  this.uuid = uuid.v4();
  this.votes = [];
};

Poll.prototype.addVote = function (person, vote) {
  this.votes.push({person: person, vote: vote});
};

Poll.prototype.getVotes = function () {
  return this.votes;
};

module.exports = Poll;


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