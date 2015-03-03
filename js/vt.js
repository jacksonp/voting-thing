(function () {
  'use strict';

  //<editor-fold desc="Custom knockout bindings">
  ko.bindingHandlers.jqmRefreshList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor()); // make this update fire each time the array is updated.
      $(element).listview('refresh');
    }
  };

  ko.bindingHandlers.jqmRefreshCheckBoxRadio = {
    init: function (element) {
      $(element).controlgroup();
      $('input[type="radio"]', element).on('checkboxradiocreate', function () {
        $(element).checkboxradio('refresh');
      });
    }
  };

  ko.bindingHandlers.jqmRefreshSlider = {
    init: function (element) {
      $(element).slider();
      //$(element).on('slidecreate', function () {
      //  $(element).slider('refresh');
      //});
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
      myData = {
        room: location.hash.replace('#', ''),
        name: localStorage.getItem('name')
      },
      //socket = io('http://votingthing.com:3883/'),
      socket = io('http://127.0.0.1:3883/'),
      newVoteNameInput = $('#new-vote-name'),
      newVoteMinInput = $('#new-vote-min'),
      newVoteMaxInput = $('#new-vote-max'),
      newVoteStepInput = $('#new-vote-step');

    // WEB_EXCLUDE_START
    document.addEventListener('resume', function () {
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



    function Person (id, name, isMe) {
      var self = this;
      self.id = id;
      self.name = ko.observable(name);
      self.is_me = isMe;
    }

    function RoomViewModel () {
      var self = this;

      self.people = ko.observableArray([]);

      function getPerson (id) {
        return ko.utils.arrayFirst(self.people(), function (p) {
          return p.id === id;
        });
      }

      self.addPerson = function (id, name) {
        var person = getPerson(id);
        if (!person) {
          self.people.push(new Person(id, name, id === myData.person_id));
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
        var newName = window.prompt('What is your name?', myData.name);
        if (!newName) {
          return;
        }
        newName = newName.trim().substring(0, 20);
        if (!newName) {
          return;
        }
        myEmit('name change', {new_name: newName});
        myData.name = newName;
        localStorage.setItem('name', newName);
      };

      self.polls = ko.observableArray([]);

      self.addPoll = function (name, ownerId, type, details, pollId, haveIVoted, ownPoll) {
        self.polls.unshift(new Poll.Poll(name, ownerId, type, details, pollId, haveIVoted, ownPoll));
      };

      self.deletePollConfirm = function (poll) {
        if (confirm('Are you sure you want to delete this poll?')) {
          myEmit('delete poll', {poll_id: poll.poll_id});
        }
      };
      socket.on('delete poll', function (poll_id) {
        self.polls.remove(function (poll) {
          return poll.poll_id === poll_id;
        });
        // See: http://knockoutjs.com/examples/animatedTransitions.html to enable this again:
        //pollInstanceArea.slideUp(300, function () {
        //  $(this).remove();
        //});
      });

      self.clearPolls = function () {
        self.polls([]);
      };

      self.addVote = function (pollId, vote) {
        var poll = ko.utils.arrayFirst(self.polls(), function (p) {
          return p.poll_id === pollId;
        });
        poll.votes.push(vote);
      };

      //<editor-fold desc="Action: vote">
      socket.on('vote', function (data) {
        self.addVote(data.poll_id, data.vote);
      });
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
      //</editor-fold>

    }

    var roomModel = new RoomViewModel();

    ko.applyBindings(roomModel);


    $('#setup-form').submit(function (event) {
      event.preventDefault();
      var
        personName = $('#setup-name').val().trim(),
        roomName = $('#setup-room').val().trim();
      // Validate room name
      if (!roomName.match(/[0-9A-Za-z]/)) {
        alert('Room name must contain some letters or numbers.');
        return;
      }
      myData.name = personName;
      localStorage.setItem('name', personName);
      setRoom(roomName);
      setupDone();
      history.pushState(null, null, '#' + roomName);
      return false;
    });

    if (!myData.room && localStorage.getItem('room_name')) {
      myData.room = localStorage.getItem('room_name');
      history.pushState(null, null, '#' + myData.room);
    }

    function setRoom (roomName) {
      roomModel.clearPolls();
      //if (!$('.poll-type-select .ui-btn-active').length) {
      //  $('.poll-type-select li').first().addClass('ui-btn-active');
      //}
      myData.room = roomName;
      $('#room-input').val(roomName);
      localStorage.setItem('room_name', roomName);
      $('h1').text(roomName);
      myEmit('enter room');
    }

    function setupDone () {
      $('.not-setup').removeClass('not-setup').addClass('done-setup');
    }

    if (myData.room && myData.name) {
      setRoom(myData.room);
      setupDone();
    }

    $('#enter-room-form').submit(function (event) {
      event.preventDefault();
      var newRoomName = $('#room-input').val();
      // Validate room name
      if (!newRoomName.match(/[0-9A-Za-z]/)) {
        alert('Room name must contain some letters or numbers.');
        return;
      }
      $('#vt-panel').panel('close');
      if (myData.room === newRoomName) {
        return; // Already in the room.
      }
      myEmit('leave room');
      setRoom(newRoomName);
      history.pushState(null, null, '#' + newRoomName);
    });


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
      polls.forEach(function (poll) {
        var haveIVoted = Object.keys(poll.votes).some(function (person_id) {
          return myData.person_id === person_id;
        });
        roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, haveIVoted, poll.owner_id === myData.person_id);
        Object.keys(poll.votes).forEach(function (key) {
          roomModel.addVote(poll.poll_id, poll.votes[key]);
        });
      });
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
    $('#create-poll-button').on('tap', function () {
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
      roomModel.addPoll(poll.poll_name, poll.owner_id, poll.type, poll.details, poll.poll_id, false, poll.owner_id === myData.person_id);
    });
    //</editor-fold>

    //<editor-fold desc="Action: vt_error">
    socket.on('vt_error', function (message) {
      //window.location.reload();
      //console.log(message);
      alert(message);
    });
    //</editor-fold>

    // <editor-fold desc="Action: reconnect">
    socket.on('reconnect', function (num) {
      console.log(num);
    });
    //</editor-fold>

  }

}());