'use strict';

var Person = function (socketId, name) {
  this.id = socketId;
  this.name = name;
};

Person.prototype.changeName = function (newName) {
  this.name = newName;
};

module.exports = Person;