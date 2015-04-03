function Person (name, id, isMe) {
  'use strict';

  var self = this;

  self.name = ko.observable(name || '').trimmed();

  if (id) {
    self.id = id;
    self.is_me = isMe;
  } else {
    if (localStorage.getItem('person_id')) {
      self.id = localStorage.getItem('person_id');
    } else {
      if (typeof device === 'undefined') {
        self.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { // http://stackoverflow.com/a/2117523
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      } else {
        // The uuid on iOS is not unique to a device, but varies for each application, for each installation. It changes if you delete and re-install the app, and possibly also when you upgrade iOS, or even upgrade the app per version (apparent in iOS 5.1). The uuid is not a reliable value.
        self.id = device.uuid;
      }
      localStorage.setItem('person_id', self.id);
    }
    self.is_me = true;
  }

}