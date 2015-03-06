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
        room: location.hash.replace('#', ''),
        name: localStorage.getItem('name')
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

    function myEmit (action, extraData) {
      extraData = extraData || {};
      socket.emit(action, $.extend(extraData, myData));
    }

    //<editor-fold desc="Sort out person_id">
    if (localStorage.getItem('person_id')) {
      myData.person_id = localStorage.getItem('person_id');
    } else {
      myData.person_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { // http://stackoverflow.com/a/2117523
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem('person_id', myData.person_id);
    }
    //</editor-fold>

    $('#setup-name').val(myData.name);
    $('#setup-room').val(myData.room);

    var roomModel = new RoomViewModel(myData, myEmit);

    ko.applyBindings(roomModel);

    socket.on('vote', function (data) {
      roomModel.addVote(data.poll_id, data.vote);
    });

    socket.on('delete poll', function (poll_id) {
      roomModel.deletePoll(poll_id);
    });


    $('#setup-form').submit(function (event) {
      event.preventDefault();
      var
        personName = $.trim($('#setup-name').val()),
        roomName = $.trim($('#setup-room').val());
      // Validate room name
      if (!roomName.match(/[0-9A-Za-z]/)) {
        alert('Room name must contain some letters or numbers.');
        return;
      }
      myData.name = personName;
      localStorage.setItem('name', personName);
      roomModel.setRoom(roomName);
      setupDone();
      history.pushState(null, null, '#' + roomName);
      return false;
    });

    if (!myData.room && localStorage.getItem('room_name')) {
      myData.room = localStorage.getItem('room_name');
      history.pushState(null, null, '#' + myData.room);
    }

    function setupDone () {
      $('.not-setup').removeClass('not-setup').addClass('done-setup');
      socket.on('reconnecting', function (num) {
        // WEB_EXCLUDE_START
        if (appRunning) {
          window.plugins.toast.showShortBottom('Reconnection attempt ' + num);
        }
        // WEB_EXCLUDE_END
      });
      socket.on('reconnect', function (num) {
        // WEB_EXCLUDE_START
        if (appRunning) {
          window.plugins.toast.showShortBottom('Reconnected');
        }
        // WEB_EXCLUDE_END
        myEmit('enter room');
      });
    }

    if (myData.room && myData.name) {
      roomModel.setRoom(myData.room);
      setupDone();
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
          return myData.person_id === person_id;
        });
        thisAdded = roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, haveIVoted, poll.owner_id === myData.person_id);
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
    $('#create-poll-button').click(function () {
      var
        pollType = $('.poll-type-select .ui-state-active a').attr('data-poll-type'),
        poll, details;
      if (pollType === 'range') {
        details = {
          min : newVoteMinInput.val(),
          max : newVoteMaxInput.val(),
          step: newVoteStepInput.val()
        };
      } else if (pollType === 'item-choice') {
        var items = [];
        $('.item-choices li').each(function () {
          items.push($(this).text());
        });
        details = {
          items: items
        };
      } else {
        alert('Could not figure out poll type.');
        return;
      }
      try {
        poll = new Poll.Poll(newVoteNameInput.val(), myData.person_id, pollType, details);
      } catch (e) {
        alert(e);
        return;
      }
      myEmit('create poll', poll);
      $('.new-poll-area').collapsible('collapse');
      $('.item-choices li').remove();
    });
    socket.on('create poll', function (poll) {
      var pollAdded = roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, false, poll.owner_id === myData.person_id);
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