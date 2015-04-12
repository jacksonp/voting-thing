(function (exports) {
  'use strict';

  exports.Poll = function (name, description, ownerId, type, details, pollId, status, myId, myEmit, votes) {

    var self = this;

    if (!name) {
      throw 'Poll needs a Name.';
    }

    if (type === 'range') {
      if (!isNumeric(details.min)) {
        throw 'Min must be a number.';
      }
      if (!isNumeric(details.max)) {
        throw 'Max must be a number.';
      }
      if (!isNumeric(details.step)) {
        throw 'Step must be a number.';
      }
      details.min = parseFloat(details.min);
      details.max = parseFloat(details.max);
      details.step = parseFloat(details.step);
      if (details.min >= details.max) {
        throw 'Max must be more than Min.';
      }
      if (details.step > details.max - details.min) {
        throw 'Step is too large.';
      }
      if (!details.decimals) {
        details.decimals = decimalPlaces(details.step);
      }
    } else if (type === 'item-choice') {
      if (!details.items) {
        throw 'No items';
      }
      if (details.items.length < 2) {
        throw 'Add at least two items.'
      }
    } else {
      throw 'Could not figure out poll type.';
    }

    self.poll_name = name;
    self.description = description;
    self.owner_id = ownerId;
    self.type = type;
    self.details = details;
    self.poll_id = pollId;
    self.myId = myId;
    self.ownPoll = ownerId === myId;

    if (typeof ko !== 'undefined') { // knockout - client-side only

      self.votes = ko.observableArray(votes || []);

      self.status = ko.observable(status);

      self.haveIVoted = ko.computed(function () {
        return ko.utils.arrayFirst(self.votes(), function (vote) {
          return vote.person_id === self.myId;
        });
      });

      self.getVote = function (person_id) {
        return ko.utils.arrayFirst(self.votes(), function (v) {
          return v.person_id === person_id;
        });
      };

      self.addVote = function (vote) {
        var voteExists = self.getVote(vote.person_id);
        if (!voteExists) {
          self.votes.push(vote);
        }
      };

      if (self.type === 'range') {
        self.voteSum = ko.pureComputed(function () {
          var tot = 0;
          for (var i = 0; i < self.votes().length; i++) {
            tot += self.votes()[i].vote;
          }
          return tot.toFixed(self.details.decimals);
        });
        self.voteAvg = ko.pureComputed(function () {
          return (self.voteSum() / self.votes().length).toFixed(Math.max(1, self.details.decimals));
        });
      } else if (type === 'item-choice') {
        self.itemTot = function (item) {
          return ko.pureComputed(function () {
            var tot = 0;
            for (var i = 0; i < self.votes().length; i++) {
              if (self.votes()[i].vote === item) {
                tot += 1;
              }
            }
            return tot;
          })();
        };
      }

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
      };

      self.pollText = ko.observable('');

      self.setPollText = function () {
        var text = '';
        if (self.status() === 'closed') {
          text = 'This poll is closed to new votes.';
        }
        self.pollText(text);
      };

      self.setPollText();

      var lastConfirmTimeout;

      self.resetConfirmButtons = function (event) {
        clearTimeout(lastConfirmTimeout);
        $(event.currentTarget).parent().find('button').buttonMarkup({theme: 'a'});
      };

      self.closePollConfirm = function (poll, event) {
        var myMessage = 'Tap again to close poll.';
        if (self.pollText() === myMessage) {
          self.setPollText();
          myEmit('close poll', {poll_id: self.poll_id});
        } else {
          self.resetConfirmButtons(event);
          self.pollText(myMessage);
          $(event.currentTarget).buttonMarkup({theme: 'b'});
          lastConfirmTimeout = setTimeout(function () {
            self.setPollText();
            $(event.currentTarget).buttonMarkup({theme: 'a'});
          }, 3000);
        }
      };

      self.deletePollConfirm = function (poll, event) {
        var myMessage = 'Tap again to delete poll.';
        if (self.pollText() === myMessage) {
          self.setPollText();
          myEmit('delete poll', {poll_id: self.poll_id});
        } else {
          self.resetConfirmButtons(event);
          self.pollText(myMessage);
          $(event.currentTarget).buttonMarkup({theme: 'b'});
          lastConfirmTimeout = setTimeout(function () {
            self.setPollText();
            $(event.currentTarget).buttonMarkup({theme: 'a'});
          }, 3000);
        }
      };

    }

  };

  function isNumeric (n) {
    // see jquery.isNumeric implementation.
    return (n - parseFloat(n) + 1) >= 0;
  }

  // http://stackoverflow.com/a/10454560
  function decimalPlaces (num) {
    var match = ('' + num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
      return 0;
    }
    return Math.max(0,
      // Number of digits right of decimal point.
      (match[1] ? match[1].length : 0)
        // Adjust for scientific notation.
      - (match[2] ? +match[2] : 0));
  }

})(typeof exports === 'undefined' ? this['Poll'] = {} : exports);
