function Person (name, id, isMe) {
  'use strict';

  var self = this;

  self.name = ko.observable(name);

  if (id) {
    self.id = id;
    self.is_me = isMe;
  } else {
    if (localStorage.getItem('person_id')) {
      self.id = localStorage.getItem('person_id');
    } else {
      self.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { // http://stackoverflow.com/a/2117523
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem('person_id', self.id);
    }
    self.is_me = true;
  }

}