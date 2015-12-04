/*global device */
function PushNotifications (handleNotification) {
  'use strict';

  var self = this;

  self.data = {
    device_model       : device.model,
    device_manufacturer: device.manufacturer,
    device_version     : device.version,
    device_platform    : device.platform
  };

  var push = PushNotification.init({
    android: {
      senderID: '134289769184'
    },
    ios    : {
      alert: 'true',
      badge: 'true',
      sound: 'true'
    },
    windows: {}
  });

  push.on('registration', function (data) {
    if (device.platform === 'Android') {
      self.data.android_registration_id = data.registrationId;
    } else if (device.platform === 'iOS') {
      self.data.ios_device_token = data.registrationId;
    } else {
      appAlert('Unknown platform ' + device.platform);
    }
  });

  push.on('error', function (error) {
    appAlert(error);
  });

  push.on('notification', function (data) {
    handleNotification(data);
  });

}
