function RoomViewModel (socket, setupDoneCB) {
  'use strict';

  var self = this;

  var prevRooms = [];

  function addRoomToHistory (room) {
    if (!room) {
      return;
    }
    if (room !== localStorage.getItem('room_name')) {
      localStorage.setItem('room_name', room);
    }
    if (location.hash.replace('#', '') !== room) { // hash change could be root of this event...
      history.pushState(null, null, '#' + encodeURIComponent(room));
    }
    prevRooms.push(room);
  }

  // WEB_EXCLUDE_START
  document.addEventListener('backbutton', function () {
    var lastRoom = prevRooms.pop(); // current room
    lastRoom = prevRooms.pop(); // prev room
    if (lastRoom) {
      self.room(lastRoom);
    } else {
      navigator.app.exitApp();
    }
  }, false);
  // WEB_EXCLUDE_END

  $(window).on('hashchange', function () {
    var room = location.hash.replace('#', '');
    if (room) {
      self.room(room);
    }
    //$('h1').text(location.hash.slice(1));
  });

  self.isSetup = ko.observable(false);

  self.room = ko.observable('').trimmed();

  // See if room is set in URL hash, and if not if set in localStorage.
  self.roomInput = ko.observable(location.hash.replace('#', '') || localStorage.getItem('room_name') || '').trimmed();

  self.me = new Person(localStorage.getItem('name'));

  self.newPollName = ko.observable('').trimmed();

  self.newItemInput = ko.observable('').trimmed();
  self.items = ko.observableArray([]);

  self.newPollMin = ko.observable(1);
  self.newPollMax = ko.observable(10);
  self.newPollStep = ko.observable(1);


  function myEmit (action, extraData) {
    extraData = extraData || {};
    socket.emit(action, $.extend(extraData, {
      room     : self.room(),
      person_id: self.me.id,
      name     : self.me.name()
    }));
  }

  function setupDone () {
    self.isSetup(true);
    self.room(self.roomInput());
    addRoomToHistory(self.roomInput());
    myEmit('enter room');
    self.room.subscribe(function (newRoomName) {
      self.clearPolls();
      $('.new-poll-area').collapsible('collapse');
      addRoomToHistory(newRoomName);
      myEmit('enter room');
      self.roomInput(newRoomName);
    });
    setupDoneCB();
  }

  self.sync = function () {
    myEmit('enter room');
  };

  self.refresh = function () {
    window.location.reload();
  };

  self.setup = function () {
    localStorage.setItem('name', self.me.name());
    setupDone();
  };

  self.enterRoom = function () {
    var newRoomName = self.roomInput();
    $('#vt-panel').panel('close');
    if (self.room() === newRoomName) {
      return; // Already in the room.
    }
    myEmit('leave room');
    self.room(newRoomName);
  };

  self.people = ko.observableArray([]);

  function getPerson (id) {
    return ko.utils.arrayFirst(self.people(), function (p) {
      return p.id === id;
    });
  }

  self.addPerson = function (id, name) {
    var person = getPerson(id);
    if (!person) {
      self.people.push(new Person(name, id, id === self.me.id));
    }
  };

  self.removePerson = function (id) {
    self.people.remove(function (item) {
      return item.id === id;
    });
  };

  self.renamePerson = function (id, name) {
    var person = getPerson(id);
    if (person) {
      person.name(name);
    } else {
      self.addPerson(id, name);
    }
  };

  self.editName = function () {
    var newName = window.prompt('What is your name?', self.me.name());
    if (!newName) {
      return;
    }
    newName = newName.trim().substring(0, 20);
    if (!newName) {
      return;
    }
    myEmit('name change', {new_name: newName});
    self.me.name(newName);
    localStorage.setItem('name', newName);
  };

  self.polls = ko.observableArray([]);

  function getPoll (id) {
    return ko.utils.arrayFirst(self.polls(), function (p) {
      return p.poll_id === id;
    });
  }

  self.jqmRefreshSetup = function (element) {
    $(element).enhanceWithin();
  };

  self.jqmRefreshPollArea = function (element) {
    $(element).parent().enhanceWithin();
  };

  self.createPoll = function (poll) {
    var pollAdded = self.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, false, poll.owner_id === self.me.id);
    if (pollAdded) {
      revealFirstPoll();
    }
  };

  // This may be called (once) after multiple polls have been added.
  function revealFirstPoll () {
    var polls = $('.poll');
    if (polls.length < 3) {
      polls.first().collapsible('expand');
    }
  }

  self.addPolls = function (polls) {
    var i, p, newPolls = [], poll, votes;

    for (i = 0; i < polls.length; i += 1) {
      p = polls[i];
      votes = [];

      Object.keys(p.votes).forEach(function (person_id) {
        p.votes[person_id].person_id = person_id;
        votes.push(p.votes[person_id]);
      });

      // consider doing this when adding votes instead...
      var haveIVoted = Object.keys(p.votes).some(function (person_id) {
        return self.me.id === person_id;
      });
      poll = new Poll.Poll(p.poll_name, p.owner_id, p.type, p.details, p.poll_id, haveIVoted, p.owner_id === self.me.id, votes);
      newPolls.unshift(poll);
    }

    if (newPolls.length) {
      self.polls.unshift.apply(self.polls, newPolls);
      revealFirstPoll();
    }
  };

  self.addPoll = function (name, ownerId, type, details, pollId, haveIVoted, ownPoll) {
    var poll = getPoll(pollId);
    if (poll) {
      return false; // Already exists.
    }
    self.polls.unshift(new Poll.Poll(name, ownerId, type, details, pollId, haveIVoted, ownPoll));
    return true;
  };

  self.addItem = function () {
    var itemText = self.newItemInput();
    if (!itemText) {
      return;
    }
    var exists = ko.utils.arrayFirst(self.items(), function (i) {
      return itemText === i;
    });
    if (exists) {
      alert('Duplicate!');
      return;
    }
    self.newItemInput('');
    $('#new-item-choice').focus();
    self.items.push(itemText);
  };

  self.removeItem = function (item) {
    self.items.remove(item);
  };

  self.createPoll = function () {
    var
      pollType = $('.poll-type-select .ui-state-active a').attr('data-poll-type'),
      poll, details;

    if (pollType === 'range') {
      details = {
        min : self.newPollMin(),
        max : self.newPollMax(),
        step: self.newPollStep()
      };
    } else if (pollType === 'item-choice') {
      details = {
        items: self.items()
      };
    } else {
      alert('Could not figure out poll type.');
      return;
    }
    try {
      poll = new Poll.Poll(self.newPollName(), self.me.id, pollType, details);
    } catch (e) {
      alert(e);
      return;
    }
    myEmit('create poll', poll);
    $('.new-poll-area').collapsible('collapse');
    self.items.removeAll();
  };

  self.sharePoll = function (poll) {
    // APP_EXCLUDE_START
    var sharePopup = $('#share-popup');
    sharePopup.find('input').val('http://www.votingthing.com/#' + self.room());
    sharePopup.popup('open');
    sharePopup.find('input').select();
    // APP_EXCLUDE_END
    // WEB_EXCLUDE_START
    window.plugins.socialsharing.share('Vote here:', self.room() + ': ' + poll.poll_name, null, 'http://www.votingthing.com/#' + self.room());
    // WEB_EXCLUDE_END
  };

  self.deletePollConfirm = function (poll) {
    if (confirm('Are you sure you want to delete this poll?')) {
      myEmit('delete poll', {poll_id: poll.poll_id});
    }
  };
  self.deletePoll = function (poll_id) {
    self.polls.remove(function (poll) {
      return poll.poll_id === poll_id;
    });
    // See: http://knockoutjs.com/examples/animatedTransitions.html to enable this again:
    //pollInstanceArea.slideUp(300, function () {
    //  $(this).remove();
    //});
  };

  self.rerunPoll = function (poll) {
    self.newPollName(poll.poll_name);
    if (poll.type === 'range') {
      self.newPollMin(poll.details.min);
      self.newPollMax(poll.details.max);
      self.newPollStep(poll.details.step);
      $('.poll-type-select [data-poll-type="range"]').trigger('click');
    } else {
      self.items(poll.details.items);
      $('.poll-type-select [data-poll-type="item-choice"]').trigger('click');
    }

    $('.new-poll-area').collapsible('expand');
    $('#new-poll-name').focus();
  };

  self.clearPolls = function () {
    self.polls([]);
  };

  self.addVote = function (pollId, vote) {
    var poll = getPoll(pollId);
    poll.addVote(vote);
  };

  self.vote = function (poll, event) {

    var
      vote,
      pollInstanceArea = $(event.currentTarget).closest('.poll');

    if (poll.type === 'range') {
      vote = pollInstanceArea.find('input[name=vote-input]').val();
      if (!$.isNumeric(vote)) {
        if (vote != '') {
          alert('Enter a number.');
        }
        return;
      }
      vote = parseFloat(vote);
    } else if (poll.type === 'item-choice') {
      vote = pollInstanceArea.find('input[name=vote-input]:checked');
      if (!vote.length) {
        alert('Select an item.');
        return;
      }
      vote = vote.val();
    } else {
      alert('Could not figure out poll type.');
      return;
    }
    myEmit('vote', {poll_id: poll.poll_id, vote: vote});
    poll.haveIVoted(true);
  };

  // Are we ready?
  if (self.roomInput() && self.me.name()) {
    setupDone();
  }

}