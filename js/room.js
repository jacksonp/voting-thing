function RoomViewModel (socket) {
  'use strict';

  var self = this;

  self.room = ko.observable(location.hash.replace('#', ''));

  self.me = new Person(localStorage.getItem('name'));

  if (!self.room() && localStorage.getItem('room_name')) {
    self.room(localStorage.getItem('room_name'));
    history.pushState(null, null, '#' + self.room());
  }

  function myEmit (action, extraData) {
    extraData = extraData || {};
    socket.emit(action, $.extend(extraData, {
      room     : self.room(),
      person_id: self.me.id,
      name     : self.me.name()
    }));
  }

  self.setupDone = function () {
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
  };

  self.setup = function () {
    var
      personName = $.trim($('#setup-name').val()),
      roomName = $.trim($('#setup-room').val());
    // Validate room name
    if (!roomName.match(/[0-9A-Za-z]/)) {
      alert('Room name must contain some letters or numbers.');
      return;
    }
    self.me.name(personName);
    localStorage.setItem('name', personName);
    self.setRoom(roomName);
    self.setupDone();
    history.pushState(null, null, '#' + roomName);
  };

  self.setRoom = function (roomName) {
    self.clearPolls();
    self.room(roomName);
    localStorage.setItem('room_name', roomName);
    $('h1').text(roomName);
    myEmit('enter room');
  };

  self.enterRoom = function (formElement) {
    var newRoomName = $.trim($(formElement).find('#room-input').val());
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
    self.setRoom(newRoomName);
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

  self.addPoll = function (name, ownerId, type, details, pollId, haveIVoted, ownPoll) {
    var poll = getPoll(pollId);
    if (poll) {
      return false; // Already exists.
    }
    self.polls.unshift(new Poll.Poll(name, ownerId, type, details, pollId, haveIVoted, ownPoll));
    return true;
  };


  self.createPoll = function () {
    var
      pollType = $('.poll-type-select .ui-state-active a').attr('data-poll-type'),
      poll, details,
      newVoteNameInput = $('#new-vote-name'),
      newVoteMinInput = $('#new-vote-min'),
      newVoteMaxInput = $('#new-vote-max'),
      newVoteStepInput = $('#new-vote-step');

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
      poll = new Poll.Poll(newVoteNameInput.val(), self.me.id, pollType, details);
    } catch (e) {
      alert(e);
      return;
    }
    myEmit('create poll', poll);
    $('.new-poll-area').collapsible('collapse');
    $('.item-choices li').remove();
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


  if (self.room() && self.me.name()) {
    self.setRoom(self.room());
    self.setupDone();
  }

}