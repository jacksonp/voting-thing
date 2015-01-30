'use strict';

var Room = function (name) {
  this._name = name;
  this._people = [];
  this._votes = [];
};

Room.prototype.addPerson = function (person) {
  this._people.push(person);
};

Room.prototype.removePerson = function (id) {
  this._people = this._people.filter(function (el) {
    return el.id !== id;
  });
};

Room.prototype.getPerson = function (id) {
  var person = null;
  this._people.some(function (el) {
    if (el.id === id) {
      person = el;
      return true;
    }
  });
  return person;
};

Room.prototype.getPeople = function () {
  return this._people;
};

Room.prototype.addVote = function (vote) {
  this._votes.push(vote);
};

Room.prototype.getVote = function (uuid) {
  var vote = null;
  this._votes.some(function (el) {
    if (el.uuid === uuid) {
      vote = el;
      return true;
    }
  });
  return vote;
};

module.exports = Room;