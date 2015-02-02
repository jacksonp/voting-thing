'use strict';

var Room = function (name) {
  this.name = name;
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

Room.prototype.getPerson = function (id) {
  var person = null;
  this.people.some(function (el) {
    if (el.id === id) {
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
  var vote = null;
  this.polls.some(function (el) {
    if (el.uuid === uuid) {
      vote = el;
      return true;
    }
  });
  return vote;
};

Room.prototype.getPolls = function () {
  return this.polls;
};

module.exports = Room;