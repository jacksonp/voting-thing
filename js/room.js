function RoomViewModel (socket, setupDoneCB) {
  'use strict';

  var self = this;

  self.roomHistory = new RoomHistoryViewModel();

  self.people = new PeopleViewModel(myEmit);

  self.createPoll = new CreatePollViewModel(myEmit, self.people.me);

  // WEB_EXCLUDE_START
  document.addEventListener('backbutton', function () {
    var lastRoom = self.roomHistory.popLastRoom();
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

  self.polls = ko.observableArray([]);

  function myEmit (action, extraData) {
    extraData = extraData || {};
    socket.emit(action, $.extend(extraData, {
      room     : self.room(),
      person_id: self.people.me.id,
      name     : self.people.me.name()
    }));
  }

  // Infinite scrolling aka we don't show necessarily show all polls in room by default.
  // See: https://jqmtricks.wordpress.com/2014/07/15/infinite-scrolling/
  function checkScroll () {
    var
      screenHeight = $.mobile.getScreenHeight(),
      contentHeight = $('.ui-content').outerHeight(),
      scrolled = $(window).scrollTop(),
      header = $('.ui-header').outerHeight() - 1,
      scrollEnd = contentHeight - screenHeight + header;
    if (scrollEnd > 0 && scrolled >= scrollEnd) {
      $(document).off('scrollstop');
      var underlyingPolls = self.polls();
      myEmit('older polls', {oldest_poll_id: underlyingPolls[underlyingPolls.length - 1].poll_id});
    }
  }

  function setupDone () {
    $('#vt-header').removeClass('vt-synced');
    self.isSetup(true);
    self.room(self.roomInput());
    self.roomHistory.addRoomToHistory(self.roomInput(), '');
    myEmit('enter room');
    self.room.subscribeChanged(function (newRoomName, oldRoomName) {
      $('#vt-header').removeClass('vt-synced');
      self.polls.removeAll();
      self.people.removeAll();
      $('.new-poll-area').collapsible('collapse');
      self.roomHistory.addRoomToHistory(newRoomName, oldRoomName);
      myEmit('enter room');
      self.roomInput(newRoomName);
    });

    $(document).on('scrollstop', checkScroll);

    setupDoneCB();
  }

  self.goToRoom = function (newRoomName) {
    $('#vt-panel').panel('close');
    if (self.room() === newRoomName) {
      return; // Already in the room.
    }
    myEmit('leave room');
    self.room(newRoomName);
  };

  self.sync = function () {
    self.polls.removeAll();
    myEmit('enter room');
  };

  self.refresh = function () {
    window.location.reload();
  };

  self.setup = function () {
    localStorage.setItem('name', self.people.me.name());
    setupDone();
  };

  self.roomFormSubmit = function () {
    self.goToRoom(self.roomInput());
  };

  self.getPoll = function (id) {
    return ko.utils.arrayFirst(self.polls(), function (p) {
      return p.poll_id === id;
    });
  };

  self.jqmRefreshSetup = function (element) {
    $(element).enhanceWithin();
  };

  self.jqmRefreshPollArea = function (element) {
    $(element).parent().enhanceWithin();
  };

  self.addPoll = function (data) {
    var poll = new Poll.Poll(data.poll_name, data.owner_id, data.type, data.details, data.poll_id, data.status, self.people.me.id);
    self.polls.unshift(poll);
    if (poll.ownPoll) { // I just created this poll...
      $('.new-poll-area').collapsible('collapse');
      self.createPoll.items.removeAll();
    }
    revealFirstPoll(true);
  };

  // This may be called (once) after multiple polls have been added.
  function revealFirstPoll (force) {
    var polls = $('.poll');
    if (force || polls.length < 3) {
      polls.first().collapsible('expand');
    }
  }

  self.addPolls = function (data, olderPolls) {
    var i, p, newPolls = [], poll, votes;

    for (i = 0; i < data.polls.length; i += 1) {
      p = data.polls[i];
      votes = [];

      Object.keys(p.votes).forEach(function (person_id) {
        p.votes[person_id].person_id = person_id;
        votes.push(p.votes[person_id]);
      });

      poll = new Poll.Poll(p.poll_name, p.owner_id, p.type, p.details, p.poll_id, p.status, self.people.me.id, votes);
      newPolls.push(poll); // reverses the order, were sorted DESC
    }

    if (newPolls.length) {
      if (olderPolls) {
        self.polls.push.apply(self.polls, newPolls);
        if (data.more_available) {
          $(document).on('scrollstop', checkScroll);
        }
      }
      else {
        self.polls.unshift.apply(self.polls, newPolls);
        revealFirstPoll();
      }
    }
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

  self.closePollConfirm = function (poll) {
    if (confirm('Are you sure you want to close this poll?')) {
      myEmit('close poll', {poll_id: poll.poll_id});
    }
  };
  self.closePoll = function (poll_id, callback) {
    var poll = self.getPoll(poll_id);
    poll.status('closed');
    callback('Poll closed: ' + poll.poll_name);
  };
  self.deletePollConfirm = function (poll) {
    if (confirm('Are you sure you want to delete this poll?')) {
      myEmit('delete poll', {poll_id: poll.poll_id});
    }
  };
  self.deletePoll = function (poll_id, callback) {
    var removed = self.polls.remove(function (poll) {
      return poll.poll_id === poll_id;
    });
    callback('Poll deleted: ' + removed.pop().poll_name);
    // See: http://knockoutjs.com/examples/animatedTransitions.html to enable this again:
    //pollInstanceArea.slideUp(300, function () {
    //  $(this).remove();
    //});
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
  };

  // Are we ready?
  if (self.roomInput() && self.people.me.name()) {
    setupDone();
  }

}