function RoomHistoryViewModel () {
  'use strict';

  var self = this;

  //<editor-fold desc="Setup self.prevRooms">
  (function () {
    var prevRooms = localStorage.getItem('prev_rooms');
    if (prevRooms) {
      prevRooms = JSON.parse(prevRooms);
    } else {
      prevRooms = [];
    }
    self.prevRooms = ko.observableArray(prevRooms);
  }());
  //</editor-fold>

  self.addRoomToHistory = function (room, oldRoom) {
    if (!room) {
      return;
    }
    if (room !== localStorage.getItem('room_name')) {
      localStorage.setItem('room_name', room);
    }
    if (location.hash.replace('#', '') !== room) { // hash change could be root of this event...
      history.pushState(null, null, '#' + encodeURIComponent(room));
    }
    if (oldRoom) {
      self.prevRooms.remove(room);
      self.prevRooms.remove(oldRoom);
      self.prevRooms.unshift(oldRoom);
      if (self.prevRooms().length > 5) {
        self.prevRooms.pop();
      }
      localStorage.setItem('prev_rooms', JSON.stringify(self.prevRooms()));
    }
  };

  self.popLastRoom = function () {
    return self.prevRooms.shift();
  };

}