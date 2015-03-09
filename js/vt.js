(function () {
  'use strict';

  //<editor-fold desc="Custom knockout bindings">
  ko.bindingHandlers.jqmRefreshList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor()); // make this update fire each time the array is updated.
      $(element).listview('refresh');
    }
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
    init();
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
      appRunning = true,
      myData = {
        room: location.hash.replace('#', '')
      },
      socket = io('http://votingthing.com:3883/'),
      //socket = io('http://192.168.1.69:3883/'),
      newVoteNameInput = $('#new-vote-name'),
      newVoteMinInput = $('#new-vote-min'),
      newVoteMaxInput = $('#new-vote-max'),
      newVoteStepInput = $('#new-vote-step');

    // WEB_EXCLUDE_START
    document.addEventListener('pause', function () {
      appRunning = false;
    }, false);
    document.addEventListener('resume', function () {
      appRunning = true;
      socket.io.reconnect();
    }, false);
    // WEB_EXCLUDE_END

    var roomModel = new RoomViewModel(myData, socket);

    ko.applyBindings(roomModel);

    $('#setup-name').val(roomModel.me.name());
    $('#setup-room').val(myData.room);

    socket.on('vote', function (data) {
      roomModel.addVote(data.poll_id, data.vote);
    });

    socket.on('delete poll', function (poll_id) {
      roomModel.deletePoll(poll_id);
    });

    if (!myData.room && localStorage.getItem('room_name')) {
      myData.room = localStorage.getItem('room_name');
      history.pushState(null, null, '#' + myData.room);
    }

    if (myData.room && roomModel.me.name()) {
      roomModel.setRoom(myData.room);
      roomModel.setupDone();
    }

    //<editor-fold desc="Sort out default new vote form values">
    (function () {
      newVoteNameInput.val(localStorage.getItem('new-vote-name') ? localStorage.getItem('new-vote-name') : 'Poll Name');
      newVoteMinInput.val(localStorage.getItem('new-vote-min') ? localStorage.getItem('new-vote-min') : 1);
      newVoteMaxInput.val(localStorage.getItem('new-vote-max') ? localStorage.getItem('new-vote-max') : 10);
      newVoteStepInput.val(localStorage.getItem('new-vote-step') ? localStorage.getItem('new-vote-step') : 1);
    }());
    //</editor-fold>

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
    $('#add-item-choice').on('tap', function () {
      var input = $('#new-item-choice');
      var itemText = input.val().trim();
      if (!itemText) {
        return;
      }
      var itemChoices = $('.item-choices');
      var exists = false;
      itemChoices.each(function () {
        if ($(this).text() === itemText) {
          exists = true;
        }
      });
      if (exists) {
        alert('Duplicate!');
        return;
      }
      var li = $('<li>').text(itemText);
      input.val('');
      itemChoices.append(li);
      itemChoices.listview('refresh');
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
      //window.location.reload();
      //console.log(message);
      alert(message);
    });
    //</editor-fold>

  }

}());