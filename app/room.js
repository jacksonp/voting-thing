'use strict';

function normalizeName (name) {
  return name.toLowerCase().replace(/[^0-9a-z]+/g, '');
}

var Room = function (name) {
  this.name = name;
  this.normName = normalizeName(name);
  this.people = [];
  this.polls = [];
};

// If there is a person with the same id already in the room, remove them before adding.
Room.prototype.addPerson = function (person) {
  if (this.getPerson(person.id) !== null) {
    this.removePerson(person.id);
  }
  this.people.push(person);
};

// Does nothing if person is not in room.
Room.prototype.removePerson = function (id) {
  this.people = this.people.filter(function (el) {
    return el.id !== id;
  });
};

Room.prototype.getPerson = function (uuid) {
  var person = null;
  this.people.some(function (el) {
    if (el.uuid === uuid) {
      person = el;
      return true;
    }
  });
  return person;
};

Room.prototype.getPeople = function () {
  return this.people;
};

Room.prototype.addPoll = function (poll) {
  this.polls.push(poll);
};

Room.prototype.getPoll = function (uuid) {
  var poll = null;
  this.polls.some(function (el) {
    if (el.uuid === uuid) {
      poll = el;
      return true;
    }
  });
  return poll;
};

Room.prototype.getPolls = function () {
  return this.polls;
};

Room.normalizeName = function (name) {
  return normalizeName(name);
};

module.exports = Room;