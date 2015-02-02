'use strict';

var Person = function (socketId, guid, name) {
  this.id = socketId;
  this.guid = guid;
  this.name = name;
};

Person.prototype.changeName = function (newName) {
  this.name = newName;
};

module.exports = Person;