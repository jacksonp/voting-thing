function appAlert (msg, title) {
  'use strict';
  title = title || 'Error';

  // WEB_EXCLUDE_START
  navigator.notification.alert(msg, function () {}, title);
  // WEB_EXCLUDE_END
  // APP_EXCLUDE_START
  alert(msg);
  // APP_EXCLUDE_END
}