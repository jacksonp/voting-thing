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

  function registerSuccess (result) {
    // Do nothing.
  }

  function registerError (error) {
    alert('error: ' + error);
  }

  function tokenHandler (result) {
    // Your iOS push server needs to know the token before it can push to this device.
    self.data.ios_device_token = result;
  }

  self.register = function () {
    if (device.platform === 'android' || device.platform === 'Android' || device.platform === 'amazon-fireos') {
      window.plugins.pushNotification.register(registerSuccess, registerError, {
        senderID: '134289769184',
        ecb     : 'onNotification'
      });
    } else {
      window.plugins.pushNotification.register(tokenHandler, registerError, {
        badge: 'true',
        //sound: 'true',
        alert: 'true',
        ecb  : 'onNotificationAPN'
      });
    }
  };

  // Android and Amazon Fire OS (Looks like we need this to be a global function for the plugin).
  window.onNotification = function (e) {

    switch (e.event) {
      case 'registered':
        if (e.regid.length > 0) {
          // Your GCM push server needs to know the regID before it can push to this device
          // here is where you might want to send it the regID for later use.
          self.data.android_registration_id = e.regid;
        }
        break;

      case 'message':

        /*
         // if this flag is set, this notification happened while we were in the foreground.
         // you might want to play a sound to get the user's attention, throw up a dialog, etc.
         if (e.foreground) {

           } else {  // otherwise we were launched because the user touched a notification in the notification tray.
           if (e.coldstart) {

           } else {

           }
         }
         */

        handleNotification(e.payload);

        break;

      case 'error':
        alert(e.msg);
        break;

      default:
        alert(e.event + ' not supported.');
        break;
    }

  };

  // iOS (Looks like we need this to be a global function for the plugin).
  window.onNotificationAPN = function (e) {
    handleNotification(e);
  };

}