function CreatePollViewModel (myEmit, me) {
  'use strict';

  var self = this;

  self.newPollName = ko.observable('').trimmed();
  self.newPollDesc = ko.observable('').trimmed();

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
      poll = new Poll.Poll(self.newPollName(), self.newPollDesc(), me.id, pollType, details);
    } catch (e) {
      alert(e);
      return;
    }
    myEmit('create poll', poll);
  };

  self.rerunPoll = function (poll) {
    self.newPollName(poll.poll_name);
    if (poll.type === 'range') {
      self.newPollMin(poll.details.min);
      self.newPollMax(poll.details.max);
      self.newPollStep(poll.details.step);
      $('.poll-type-select [data-poll-type="range"]').trigger('click');
    } else {
      self.items(poll.details.items);
      $('.poll-type-select [data-poll-type="item-choice"]').trigger('click');
    }

    $('.new-poll-area').collapsible('expand');
    $('#new-poll-name').focus();
  };

}