(function () {
  'use strict';

  //<editor-fold desc="Custom knockout stuff">
  ko.bindingHandlers.jqmRefreshList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor()); // make this update fire each time the array is updated.
      $(element).listview().listview('refresh');
    }
  };

  ko.subscribable.fn.trimmed = function () {
    return ko.computed({
      read : function () {
        return this().trim();
      },
      write: function (value) {
        this(value.trim());
        this.valueHasMutated();
      },
      owner: this
    });
  };
  //</editor-fold>

  var
    deviceReady = false,
    domReady = false;

  // APP_EXCLUDE_START
  deviceReady = true;
  // APP_EXCLUDE_END
  // WEB_EXCLUDE_START
  document.addEventListener('deviceready', function () {
    deviceReady = true;

    window.webintent.getUri(function (uri) {
      if (uri) {
        var hash = uri.split('#').slice(1).join("#");
        if (hash) {
          history.pushState(null, null, '#' + hash);
        }
      }
      init();
    });

  }, false);
  // WEB_EXCLUDE_END

  $(function () {
    domReady = true;
    init();
  });

  function init () {

    if (!deviceReady || !domReady) {
      return;
    }

    var
      socket = io('http://votingthing.com:3883/'),
      //socket = io('http://192.168.1.69:3883/'),
      appRunning = true;

    // WEB_EXCLUDE_START
    document.addEventListener('pause', function () {
      appRunning = false;
    }, false);
    document.addEventListener('resume', function () {
      appRunning = true;
      socket.io.reconnect();
    }, false);
    // WEB_EXCLUDE_END

    function setupDone () {
      socket.on('reconnecting', function (num) {
        $.mobile.loading('show');
        // WEB_EXCLUDE_START
        //if (appRunning) {
        //  if (num > 1) {
        //    window.plugins.toast.showShortBottom('Reconnection attempt ' + num);
        //  }
        //}
        // WEB_EXCLUDE_END
      });
      socket.on('reconnect', function (num) {
        $.mobile.loading('hide');
        // WEB_EXCLUDE_START
        if (appRunning) {
          window.plugins.toast.showShortBottom('Reconnected');
        }
        // WEB_EXCLUDE_END
        roomModel.sync();
      });
    }

    var roomModel = new RoomViewModel(socket, setupDone);

    ko.applyBindings(roomModel);

    // WEB_EXCLUDE_START
    window.webintent.onNewIntent(function (uri) {
      if (uri) {
        var hash = uri.split('#').slice(1).join("#");
        if (hash) {
          roomModel.room(hash);
        }
      }
    });
    // WEB_EXCLUDE_END

    socket.on('vote', function (data) {
      roomModel.addVote(data.poll_id, data.vote);
    });

    socket.on('delete poll', function (poll_id) {
      roomModel.deletePoll(poll_id);
    });

    //<editor-fold desc="Action: enter room">
    socket.on('enter room', function (people) {
      $.each(people, function (k, u) {
        roomModel.addPerson(u.person_id, u.name);
      });
    });
    //</editor-fold>

    socket.on('polls sync', function (polls) {
      var pollAdded = false, thisAdded;
      polls.forEach(function (poll) {
        var haveIVoted = Object.keys(poll.votes).some(function (person_id) {
          return roomModel.me.id === person_id;
        });
        thisAdded = roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, haveIVoted, poll.owner_id === roomModel.me.id);
        if (!pollAdded && thisAdded) {
          pollAdded = true;
        }
        Object.keys(poll.votes).forEach(function (person_id) {
          poll.votes[person_id].person_id = person_id;
          roomModel.addVote(poll.poll_id, poll.votes[person_id]);
        });
      });
      if (pollAdded) {
        revealFirstPoll();
      }
    });

    //<editor-fold desc="Action: name change">
    socket.on('name change', function (data) {
      roomModel.renamePerson(data.person_id, data.new_name);
    });
    //</editor-fold>

    //<editor-fold desc="Action: person left">
    socket.on('person left', function (personId) {
      roomModel.removePerson(personId);
    });
    //</editor-fold>

    //<editor-fold desc="Action: create poll">
    $('.new-poll-area').collapsible({
      // Slide up and down to prevent ghost clicks:
      collapse: function () {
        $(this).children().next().slideUp(300);
      },
      expand  : function () {
        $(this).children().next().hide();
        $(this).children().next().slideDown(300);
      }
    });

    socket.on('create poll', function (poll) {
      var pollAdded = roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, false, poll.owner_id === roomModel.me.id);
      if (pollAdded) {
        revealFirstPoll();
      }
    });
    //</editor-fold>

    // This may be called (once) after multiple polls have been added.
    function revealFirstPoll () {
      $('.poll').first().collapsible('expand');
    }

    //<editor-fold desc="Action: vt_error">
    socket.on('vt_error', function (message) {
      //console.log(message);
      alert(message);
    });
    //</editor-fold>

  }

}());