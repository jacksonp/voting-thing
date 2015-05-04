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

    // WEB_EXCLUDE_START
    document.addEventListener('offline', function () {
      $('#vt-header').removeClass('vt-synced');
      console.log('offline');
    }, false);
    document.addEventListener('online', function () {
      console.log('online');
      roomModel.onAppResume();
    }, false);
    document.addEventListener('pause', function () {
      roomModel.onAppPause();
    }, false);
    document.addEventListener('resume', function () {
      roomModel.onAppResume();
    }, false);
    // WEB_EXCLUDE_END

    roomModel = new RoomViewModel();
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