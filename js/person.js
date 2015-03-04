function Person (id, name, isMe) {
  'use strict';
  
  var self = this;
  self.id = id;
  self.name = ko.observable(name);
  self.is_me = isMe;
}