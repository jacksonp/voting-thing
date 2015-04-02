function CreatePollViewModel (myEmit, me) {
  'use strict';

  var self = this;

  self.newPollName = ko.observable('').trimmed();

  self.newItemInput = ko.observable('').trimmed();
  self.items = ko.observableArray([]);

  self.newPollMin = ko.observable(1);
  self.newPollMax = ko.observable(10);
  self.newPollStep = ko.observable(1);

  self.addItem = function () {
    var itemText = self.newItemInput();
    if (!itemText) {
      return;
    }
    var exists = ko.utils.arrayFirst(self.items(), function (i) {
      return itemText === i;
    });
    if (exists) {
      alert('Duplicate!');
      return;
    }
    self.newItemInput('');
    $('#new-item-choice').focus();
    self.items.push(itemText);
  };

  self.removeItem = function (item) {
    self.items.remove(item);
  };

  self.createPoll = function () {
    var
      pollType = $('.poll-type-select .ui-state-active a').attr('data-poll-type'),
      poll, details;

    if (pollType === 'range') {
      details = {
        min : self.newPollMin(),
        max : self.newPollMax(),
        step: self.newPollStep()
      };
    } else if (pollType === 'item-choice') {
      details = {
        items: self.items()
      };
    } else {
      alert('Could not figure out poll type.');
      return;
    }
    try {
      poll = new Poll.Poll(self.newPollName(), me.id, pollType, details);
    } catch (e) {
      alert(e);
      return;
    }
    myEmit('create poll', poll);
  };

}