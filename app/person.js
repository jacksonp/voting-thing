'use strict';

var Person = function (socketId, uuid, name) {
  this.id = socketId;
  this.uuid = uuid;
  this.name = name;
};

Person.prototype.changeName = function (newName) {
  this.name = newName;
};

Person.prototype.updateSocketId = function (socketId) {
  this.id = socketId;
};

module.exports = Person;