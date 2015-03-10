function RoomViewModel (socket, setupDoneCB) {
  'use strict';

  var self = this;

  self.isSetup = ko.observable(false);

  self.room = ko.observable(location.hash.replace('#', '')).trimmed();

  self.me = new Person(localStorage.getItem('name'));

  self.newPollName = ko.observable('').trimmed();

  self.newItemInput = ko.observable('').trimmed();
  self.items = ko.observableArray([]);

  self.newPollMin = ko.observable(1);
  self.newPollMax = ko.observable(10);
  self.newPollStep = ko.observable(1);

  if (!self.room() && localStorage.getItem('room_name')) {
    self.room(localStorage.getItem('room_name'));
    history.pushState(null, null, '#' + self.room());
  }

  self.roomInput = ko.observable(self.room()).trimmed();

  function myEmit (action, extraData) {
    extraData = extraData || {};
    socket.emit(action, $.extend(extraData, {
      room     : self.room(),
      person_id: self.me.id,
      name     : self.me.name()
    }));
  }

  self.setupDone = function () {
    self.isSetup(true);
    setupDoneCB();
  };

  self.sync = function () {
    myEmit('enter room');
  };

  self.setup = function () {
    // Validate room name
    if (!self.room().match(/[0-9A-Za-z]/)) {
      alert('Room name must contain some letters or numbers.');
      return;
    }
    localStorage.setItem('name', self.me.name());
    self.changeRoom();
    self.setupDone();
    self.roomInput(self.room());
    history.pushState(null, null, '#' + self.room());
  };

  self.changeRoom = function () {
    self.clearPolls();
    $('.new-poll-area').collapsible('collapse');
    localStorage.setItem('room_name', self.room());
    myEmit('enter room');
  };

  self.enterRoom = function (formElement) {
    var newRoomName = self.roomInput();
    // Validate room name
    if (!newRoomName.match(/[0-9A-Za-z]/)) {
      alert('Room name must contain some letters or numbers.');
      return;
    }
    $('#vt-panel').panel('close');
    if (self.room() === newRoomName) {
      return; // Already in the room.
    }
    myEmit('leave room');
    self.room(newRoomName);
    self.changeRoom();
    history.pushState(null, null, '#' + newRoomName);
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

  self.jqmEnhancePollList = function (element) {
    $(element).parent().enhanceWithin();
  };

  self.jqmRefreshSetup = function (element) {
    $(element).enhanceWithin();
  };

  self.jqmRefreshPollArea = function (element) {
    $(element).parent().enhanceWithin();
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
  if (self.room() && self.me.name()) {
    self.changeRoom();
    self.setupDone();
  }

}