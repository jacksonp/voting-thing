function RoomHistoryViewModel () {
  'use strict';

  var self = this;

  //<editor-fold desc="Setup self.prevRooms">
  (function () {
    var prevRooms = localStorage.getItem('prev_rooms');
    if (prevRooms) {
      prevRooms = JSON.parse(prevRooms);
      if (prevRooms.length && typeof prevRooms[0] === 'string') {
        prevRooms = [];
      }
    } else {
      prevRooms = [];
    }
    localStorage.setItem('prev_rooms', JSON.stringify(prevRooms));
    self.prevRooms = ko.observableArray(prevRooms);
  }());
  //</editor-fold>

  self.addRoomToHistory = function (roomId, roomName) {

    if (!roomId || !roomName) {
      return;
    }

    if (location.hash.replace('#', '') !== roomName) { // hash change could be root of this event...
      history.pushState(null, null, '#' + encodeURIComponent(roomName));
    }

    // Remove any previous occurrences of this room or dupes (name could be different format, e.g. caps).
    self.prevRooms.remove(function (prevRoom) {
      return prevRoom.id === roomId;
    });

    self.prevRooms.unshift({id: roomId, name: roomName});

    if (self.prevRooms().length > 5) {
      self.prevRooms.pop();
    }

    localStorage.setItem('prev_rooms', JSON.stringify(self.prevRooms()));

  };

  self.getLastRoom = function () {
    return self.prevRooms().length ? self.prevRooms()[0] : '';
  };

  //self.popLastRoom = function () {
  //  return self.prevRooms.shift();
  //};

}