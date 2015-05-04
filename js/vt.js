(function () {
  'use strict';

  //<editor-fold desc="Custom knockout stuff">
  ko.bindingHandlers.jqmRefreshList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor()); // make this update fire each time the array is updated.
      $(element).listview().listview('refresh');
    }
  };

  // See comment on template here: http://stackoverflow.com/a/10231716
  // Using afterAdd fires each time a thing is added, making it much to slow with lots of polls.
  ko.bindingHandlers.jqmEnhancePollList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor());  //grab dependency
      $(element).parent().enhanceWithin();
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

  ko.subscribable.fn.subscribeChanged = function (callback) {
    var oldValue;
    this.subscribe(function (_oldValue) {
      oldValue = _oldValue;
    }, this, 'beforeChange');

    var subscription = this.subscribe(function (newValue) {
      callback(newValue, oldValue);
    });

    // always return subscription
    return subscription;
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

  function connect () {



  }

  function init () {

    if (!deviceReady || !domReady) {
      return;
    }

    function toast (message) {
      // WEB_EXCLUDE_START
      if (appRunning && message) {
        window.plugins.toast.showShortBottom(message);
      }
      // WEB_EXCLUDE_END
    }

    var
    //socket = eio('http://votingthing.com:3883/'),
    socket = eio('ws://192.168.1.69:3883/'),
    appRunning = true;

    function vote (pollId, vote) {
      var poll = roomModel.getPoll(pollId);
      poll.addVote(vote);
      if (vote.person_id !== roomModel.people.me.id) {
        toast(poll.poll_name + ': ' + vote.name + ' voted.');
      }
    }

    function deletePoll (pollId) {
      var removed = roomModel.polls.remove(function (poll) {
        return poll.poll_id === pollId;
      });
      toast('Poll deleted: ' + removed.pop().poll_name);
      // See: http://knockoutjs.com/examples/animatedTransitions.html to enable this again:
      //pollInstanceArea.slideUp(300, function () {
      //  $(this).remove();
      //});
    }

    function closePoll (pollId) {
      var poll = roomModel.getPoll(pollId);
      poll.status('closed');
      toast('Poll closed: ' + poll.poll_name);
    }

    socket.on('open', function () {

      console.log('engine.io open');

      socket.on('message', function (data) {
        console.log('engine.io message');
        var receivedData = JSON.parse(data);
        console.log(receivedData);
        if (!receivedData.action) {
          console.log('No action received in following data:');
          console.log(data);
          return;
        }
        switch (receivedData.action) {
          case 'vt_error':
            alert(receivedData.message);
            break;
          case 'enter room':
            roomModel.people.addPeople(receivedData.data);
            break;
          case 'polls sync':
            roomModel.addPolls(receivedData.data);
            $('#vt-header').addClass('vt-synced');
            break;
          case 'star':
            roomModel.starred(true);
            toast(receivedData.data.message);
            break;
          case 'unstar':
            roomModel.starred(false);
            toast(receivedData.data.message);
            break;
          case 'create poll':
            roomModel.addPoll(receivedData.data);
            if (receivedData.data.owner_id !== roomModel.people.me.id) {
              toast('New poll: ' + receivedData.data.poll_name);
            }
            break;
          case 'vote':
            vote(receivedData.data.poll_id, receivedData.data.vote);
            break;
          case 'delete poll':
            deletePoll(receivedData.poll_id);
            break;
          case 'close poll':
            closePoll(receivedData.poll_id);
            break;
          case 'older polls':
            roomModel.addPolls(receivedData.data, true);
            break;
          case 'name change':
            roomModel.people.renamePerson(receivedData.data.person_id, receivedData.data.new_name);
            break;
          case 'person left':
            roomModel.people.removePerson(receivedData.personId);
            break;
          default:
            console.log('Unrecognised action received in following data:');
            console.log(data);
            return;
        }
      });

      socket.on('close', function () {
        console.log('engine.io close');
      });

      // WEB_EXCLUDE_START
      document.addEventListener('pause', function () {
        appRunning = false;
      }, false);
      document.addEventListener('resume', function () {
        appRunning = true;
        if (!socket.connected) {
          socket.io.reconnect();
        }
      }, false);
      // WEB_EXCLUDE_END

      function setupDone () {
        socket.on('reconnecting', function (num) {
          $('#vt-header').removeClass('vt-synced');
          // Possible that the reconnect event doesn't fire reliably enough to show spinner then remove.
          if (num > 1) {
            toast('Reconnecting'); // Don't show num, it gets scary high.
          }
        });
        socket.on('reconnect', function () {
          //$('#vt-header').removeClass('vt-synced'); // let this happen after call to roomModel.sync()
          toast('Connected');
          roomModel.sync();
        });
        $('#vt-panel').on('panelbeforeopen', function (event, ui) {
          setTimeout(function () {
            $('#room-input').select().focus();
          }, 300);
        });
      }

      var roomModel = new RoomViewModel(socket, setupDone, toast);
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

    });

  }

}());