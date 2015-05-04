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
    domReady = false,
    appRunning = true,
    roomModel;

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

  function toast (message) {
    // WEB_EXCLUDE_START
    if (appRunning && message) {
      window.plugins.toast.showShortBottom(message);
    }
    // WEB_EXCLUDE_END
  }

  function init () {

    if (!deviceReady || !domReady) {
      return;
    }

    // WEB_EXCLUDE_START
    document.addEventListener('offline', function () {
      console.log('offline');
    }, false);
    document.addEventListener('online', function () {
      console.log('online');
    }, false);
    document.addEventListener('pause', function () {
      roomModel.onAppPause();
      appRunning = false;
    }, false);
    document.addEventListener('resume', function () {
      appRunning = true;
      roomModel.onAppResume();
    }, false);
    // WEB_EXCLUDE_END

    function setupDone () {
      /*
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
      */
      $('#vt-panel').on('panelbeforeopen', function (event, ui) {
        setTimeout(function () {
          $('#room-input').select().focus();
        }, 300);
      });
    }

    roomModel = new RoomViewModel(setupDone, toast);
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


  }

}());