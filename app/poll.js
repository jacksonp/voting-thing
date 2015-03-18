(function (exports) {
  'use strict';

  exports.Poll = function (name, ownerId, type, details, pollId, haveIVoted, ownPoll, votes) {

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
    self.owner_id = ownerId;
    self.type = type;
    self.details = details;
    self.poll_id = pollId;
    self.ownPoll = !!ownPoll;

    if (typeof ko !== 'undefined') { // knockout - client-side only

      self.haveIVoted = ko.observable(!!haveIVoted);

      self.votes = ko.observableArray(votes || []);

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
          return (self.voteSum() / self.votes().length).toFixed(self.details.decimals);
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
