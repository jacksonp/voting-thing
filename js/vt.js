(function () {
  'use strict';

  //<editor-fold desc="Custom knockout stuff">
  ko.bindingHandlers.jqmRefreshList = {
    update: function (element, valueAccessor) {
      ko.utils.unwrapObservable(valueAccessor()); // make this update fire each time the array is updated.
      $(element).listview().listview('refresh');
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

    return this.subscribe(function (newValue) {
      callback(newValue, oldValue);
    });
  };
  //</editor-fold>

  var
    deviceReady = false,
    domReady = false,
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

  function init () {

    if (!deviceReady || !domReady) {
      return;
    }

    roomModel = new RoomViewModel();
    ko.applyBindings(roomModel);

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

    // WEB_EXCLUDE_START
    document.addEventListener('offline', function () {
      $('#vt-header').removeClass('vt-synced');
    }, false);
    document.addEventListener('online', function () {
      roomModel.onAppResume();
    }, false);
    document.addEventListener('pause', function () {
      roomModel.onAppPause();
    }, false);
    document.addEventListener('resume', function () {
      roomModel.onAppResume();
    }, false);

    window.webintent.onNewIntent(function (uri) {
      if (uri) {
        var hash = uri.split('#').slice(1).join("#");
        if (hash) {
          hash = decodeURIComponent(hash);
          roomModel.room(hash);
        }
      }
    });

    navigator.splashscreen.hide();
    // WEB_EXCLUDE_END

  }

}());