'use strict';

var Person = function (socketId, guid, name) {
  this.id = socketId;
  this.guid = guid;
  this.name = name;
};

Person.prototype.changeName = function (newName) {
  this.name = newName;
};

Person.prototype.updateSocketId = function (socketId) {
  this.id = socketId;
};

module.exports = Person;