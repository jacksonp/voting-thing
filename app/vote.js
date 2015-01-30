'use strict';

var uuid = require('node-uuid');

var Vote = function (name, min, max, step) {
  this.name = name;
  this.min = min;
  this.max = max;
  this.step = step;
  this.uuid = uuid.v4();
  this.votes = [];
};

Vote.prototype.addVote = function (person, vote) {
  this.votes.push({person: person, vote: vote});
};

Vote.prototype.getVotes = function () {
  return this.votes;
};

module.exports = Vote;