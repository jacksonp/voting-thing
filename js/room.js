function RoomViewModel () {
  'use strict';

  var
    self       = this,
    appRunning = true,
    socket,
    $headerBar = $('#vt-header');

  function trackView (screenTitle) {
    window.analytics && window.analytics.trackView(screenTitle);
  }

  function toast (message) {
    if (!message) {
      return;
    }
    if (appRunning || self.starred()) {
      // WEB_EXCLUDE_START
      window.plugins.toast.showShortBottom(message);
      // WEB_EXCLUDE_END
    }
  }

  function vote (pollId, vote) {
    var poll = self.getPoll(pollId);
    poll.addVote(vote);
    if (vote.person_id !== self.people.me.id) {
      toast(poll.poll_name + ': ' + vote.name + ' voted.');
    }
  }

  function deletePoll (pollId) {
    var removed = self.polls.remove(function (poll) {
      return poll.poll_id === pollId;
    });
    toast('Poll deleted: ' + removed.pop().poll_name);

    $('#poll-group-container').enhanceWithin();
    // See: http://knockoutjs.com/examples/animatedTransitions.html to enable this again:
    //pollInstanceArea.slideUp(300, function () {
    //  $(this).remove();
    //});
  }

  function closePoll (pollId) {
    var poll = self.getPoll(pollId);
    poll.status('closed');
    toast('Poll closed: ' + poll.poll_name);
  }

  function reopenPoll (pollId) {
    var poll = self.getPoll(pollId);
    poll.status('open');
    $('#poll-' + pollId).enhanceWithin();
    toast('Poll re-opened: ' + poll.poll_name);
  }

  function connect () {

    socket = new WebSocket('ws://votingthing.com:3883/');
    //socket = new WebSocket('ws://192.168.1.69:3883/');

    socket.onopen = function () {
      self.sync();
    };

    socket.onmessage = function (message) {
      var payload = JSON.parse(message.data);
      if (!payload.action) {
        // Silent fail.
        return;
      }
      switch (payload.action) {
        case 'vt_error':
          appAlert(payload.data);
          break;
        case 'enter room':
          // Hack for case when multiple versions of room name map to one actual room (I think this is the first time we get room_id back from DB):
          if (!self.people.empty() && payload.data.length) {
            self.roomHistory.addRoomToHistory(payload.data[0].room_id, self.room());
          }
          self.people.addPeople(payload.data);
          break;
        case 'polls sync':
          self.addPolls(payload.data);
          $headerBar.addClass('vt-synced');
          break;
        case 'star':
          self.starred(true);
          toast(payload.data.message);
          break;
        case 'unstar':
          self.starred(false);
          toast(payload.data.message);
          break;
        case 'create poll':
          self.addPoll(payload.data);
          if (payload.data.owner_id !== self.people.me.id) {
            toast('New poll: ' + payload.data.poll_name);
          }
          break;
        case 'vote':
          vote(payload.data.poll_id, payload.data.vote);
          break;
        case 'delete poll':
          deletePoll(payload.data);
          break;
        case 'close poll':
          closePoll(payload.data);
          break;
        case 'reopen poll':
          reopenPoll(payload.data);
          break;
        case 'older polls':
          self.addPolls(payload.data, true);
          $headerBar.addClass('vt-synced');
          break;
        case 'name change':
          self.people.renamePerson(payload.data.person_id, payload.data.new_name);
          break;
        case 'person left':
          self.people.removePerson(payload.data);
          break;
        default:
          // Silent fail
          return;
      }

    };

    socket.onclose = function () {
      // Try to reconnect in a few seconds, in case the server was restarted...
      setTimeout(function () {
        connect();
      }, 4000);
    };

  }

  self.onAppPause = function () {
    appRunning = false;
    //socket.close();
  };

  self.onAppResume = function () {
    appRunning = true;
    // These are WebSocket.CONSTANTS are undefined, but should be:
    // WebSocket.CONNECTING = 0
    // WebSocket.OPEN = 1
    if (!socket || socket.readyState > 1) {
      connect();
    }
  };


  self.roomHistory = new RoomHistoryViewModel();

  self.people = new PeopleViewModel(myEmit);

  self.createPoll = new CreatePollViewModel(myEmit, self.people.me);

  // WEB_EXCLUDE_START
  document.addEventListener('backbutton', function () {
    navigator.app.exitApp();
    // Previous functionality was to step through previous rooms, then quit when none left:
    //var lastRoom = self.roomHistory.popLastRoom();
    //if (lastRoom) {
    //  self.room(lastRoom);
    //} else {
    //  navigator.app.exitApp();
    //}
  }, false);
  // WEB_EXCLUDE_END

  $(window).on('hashchange', function () {
    var hash = location.hash.replace('#', '');
    if (hash) {
      hash = decodeURIComponent(hash);
      self.room(hash);
    }
    //$('h1').text(location.hash.slice(1));
  });

  self.starred = ko.observable(false);

  self.isSetup = ko.observable(false);

  self.room = ko.observable('').trimmed();

  // See if room is set in URL hash, and if not if set in localStorage.
  self.roomInput = ko.observable(decodeURIComponent(location.hash).replace('#', '') || self.roomHistory.getLastRoom()).trimmed();

  self.polls = ko.observableArray([]);

  self.groupedPolls = ko.computed(function () {
    var lastDate = '', thisDate, rows = [], current = [];
    rows.push(current);
    for (var i = 0; i < self.polls().length; i += 1) {
      thisDate = self.polls()[i].poll_date;
      if (i === 0) {
        lastDate = thisDate;
      } else if (lastDate != thisDate) {
        lastDate = thisDate;
        current = [];
        rows.push(current);
      }
      current.push(self.polls()[i]);
    }
    return rows;
  });


  function myEmit (action, extraData) {
    extraData = extraData || {};
    var data = $.extend(extraData, {
      v        : '1.3.0',
      action   : action,
      room     : self.room(),
      person_id: self.people.me.id,
      name     : self.people.me.name()
    });
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(data));
    } else {
      setTimeout(function () {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify(data));
        }
      }, 1000);
    }
  }

  var utilFns = {
    emit : myEmit,
    toast: toast
  };

  // Infinite scrolling aka we don't show necessarily show all polls in room by default.
  // See: https://jqmtricks.wordpress.com/2014/07/15/infinite-scrolling/
  function checkScroll () {
    var
      screenHeight  = $.mobile.getScreenHeight(),
      contentHeight = $('.ui-content').outerHeight(),
      scrolled      = $(window).scrollTop(),
      header        = $('.ui-header').outerHeight() - 1,
      scrollEnd     = contentHeight - screenHeight + header;
    if (scrollEnd > 0 && scrolled >= scrollEnd) {
      $(document).off('scrollstop');
      var underlyingPolls = self.polls();
      myEmit('older polls', {oldest_poll_id: underlyingPolls[underlyingPolls.length - 1].poll_id});

      // WEB_EXCLUDE_START
      if (device.platform !== 'iOS') {
        // This doesn't work on iOS:
        // animation-play-state : paused
        // See:
        // http://stackoverflow.com/questions/27362216/webkit-animation-play-state-not-working-on-ios-8-1-probably-lower-too
        $('#vt-header').removeClass('vt-synced');
      }
      // WEB_EXCLUDE_END
    }
  }

  function setupDone () {
    self.isSetup(true);
    var roomName = self.roomInput();
    self.room(roomName);
    connect();
    self.room.subscribe(function (newRoomName) {
      self.polls.removeAll();
      self.people.removeAll();
      $('.new-poll-area').collapsible('collapse');
      self.sync();
      self.roomInput(newRoomName);
      trackView('Room: ' + newRoomName);
    });

    $(document).on('scrollstop', checkScroll);

    $('#vt-panel').on('panelbeforeopen', function (event, ui) {
      setTimeout(function () {
        $('#room-input').select().focus();
      }, 300);
    });

    trackView('Room: ' + roomName);

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
    // WEB_EXCLUDE_START
    if (device.platform !== 'iOS') {
      $('#vt-header').removeClass('vt-synced');
    }
    // WEB_EXCLUDE_END
    myEmit('enter room');
  };

  self.refresh = function () {
    connect();
  };

  // WEB_EXCLUDE_START
  var pushNotifications = new PushNotifications(function (data) {
    var additionalData = data.additionalData;
    if (additionalData.foreground) {
      if (additionalData.room !== self.room()) {
        if (additionalData.voter) {
          toast(additionalData.room + ' - ' + additionalData.poll_name + ': ' + additionalData.voter + ' voted');
        } else {
          toast(additionalData.room + ': New Poll. ' + additionalData.poll_name + ' - ' + additionalData.by);
        }
      }
    } else {
      self.goToRoom(additionalData.room);
    }
  });

  self.star = function () {
    var action = self.starred() ? 'unstar' : 'star';
    myEmit(action, pushNotifications.data)
  };
  // WEB_EXCLUDE_END

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
    trackView('Setup page');
    $(element).enhanceWithin();
  };

  self.jqmRefreshPollArea = function (element) {
    $(element).parent().enhanceWithin();
  };

  self.addPoll = function (data) {
    var poll = new Poll.Poll(data.poll_name, data.description, data.owner_id, data.type, data.details, data.poll_id, data.status, self.people.me.id, utilFns);
    self.polls.unshift(poll);
    $('#poll-group-container').enhanceWithin();
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
      polls.first().collapsible().collapsible('expand');
    }
  }

  self.addPolls = function (data, olderPolls) {

    var i, p, newPolls = [], poll, votes;

    if (!olderPolls) {
      // We're syncing rather than appending polls to the bottom of the list.
      self.polls.removeAll();
    }

    for (i = 0; i < data.polls.length; i += 1) {
      p = data.polls[i];
      votes = [];

      Object.keys(p.votes).forEach(function (person_id) {
        p.votes[person_id].person_id = person_id;
        votes.push(p.votes[person_id]);
      });

      poll = new Poll.Poll(p.poll_name, p.description, p.owner_id, p.type, p.details, p.poll_id, p.status, self.people.me.id, utilFns, votes, p.poll_date);
      newPolls.push(poll); // reverses the order, were sorted DESC
    }

    if (newPolls.length) {
      if (olderPolls) {
        self.polls.push.apply(self.polls, newPolls);
        if (data.more_available) {
          $(document).on('scrollstop', checkScroll);
        }
      } else {
        self.polls(newPolls);
        revealFirstPoll();
      }
    }

    $('#poll-group-container').enhanceWithin();

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

  // Are we ready?
  if (self.roomInput() && self.people.me.name()) {
    setupDone();
  }

}
