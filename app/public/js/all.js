'use strict';

var socket = io();

var
  guid, name,
  newVoteNameInput = $('#new-vote-name'),
  newVoteMinInput  = $('#new-vote-min'),
  newVoteMaxInput  = $('#new-vote-max'),
  newVoteStepInput = $('#new-vote-step'),
  voteArea         = $('.vote-area'),
  roomArea         = $('.roomies');


//<editor-fold desc="Sort out guid">
if (localStorage.getItem('guid')) {
  guid = localStorage.getItem('guid');
} else {
  guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { // http://stackoverflow.com/a/2117523
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  localStorage.setItem('guid', guid);
}
//</editor-fold>

//<editor-fold desc="Sort out name">
function setName () {
  var res = window.prompt("What is your name?", name);
  if (res === null && name) {
    return;
  }
  res = res.trim();
  if (!res) {
    setName();
  } else {
    name = res;
    localStorage.setItem('name', name);
    $('.my-name').text(name);
    socket.emit('name change', {guid: guid, name: name});
  }
}

if (localStorage.getItem('name')) {
  name = localStorage.getItem('name');
} else {
  setName();
}

$('.my-name').text(name);
//</editor-fold>

function addPersonToRoom (name, id) {
  var li = $('<li>').attr('data-id', id);
  if (id === guid) {
    li.attr('data-icon', 'edit').append($('<a>').addClass('my-name').text(name)).on('tap', setName);
  } else {
    li.text(name);
  }
  roomArea.append(li);
  roomArea.listview('refresh');
}

function createPoll (poll, haveIVoted) {
  var html = '<div data-role="collapsible" data-collapsed="false" class="vote-instance-area" data-uuid="' + poll.uuid + '">';
  html += '<h2>' + poll.name + '</h2>';
  if (!haveIVoted) {
    html += '<div class="vote-instance-input-area">';
    html += '<input name="vote-input" value="' + (poll.min + ((poll.max - poll.min) / 2)) + '" min="' + poll.min + '" max="' + poll.max + '" step="' + poll.step + '" type="range">';
    html += '<button class="vote-button" data-theme="b">Send My Vote</button>';
    html += '</div>';
  }
  html += '<div class="vote-instance-result-area' + (haveIVoted ? '' : ' hidden') + '" data-decimals="' + poll.decimals + '">';
  html += '<table class="ui-table vote-results-table' + (haveIVoted ? '' : ' not-voted') + '"><thead><tr><th>Person</th><th>Vote</th></tr></thead><tbody></tbody>';
  html += '<tfoot><tr><th>Total</th><th class="results-sum num"></th></tr>';
  html += '<tr><th>Average</th><th class="results-avg num"></th></tr></tfoot>';
  html += '</table>';
  html += '</div>';
  html += '</div>';
  if (haveIVoted) {
    $(html).prependTo(voteArea);
    voteArea.enhanceWithin();
  } else {
    var newVote = $(html).hide().prependTo(voteArea);
    voteArea.enhanceWithin();
    newVote.slideDown();
  }
}

function addVote (uuid, name, vote) {
  var voteInstanceResultArea = $('.vote-instance-area[data-uuid=' + uuid + '] .vote-instance-result-area');
  var decimals = voteInstanceResultArea.attr('data-decimals');
  voteInstanceResultArea.slideDown();
  var resultsTable = voteInstanceResultArea.find('table');
  resultsTable.find('tbody').append('<tr><td>' + name + '</td><td class="num result-val">' + vote.toFixed(decimals) + '</td></tr>');
  var sum = 0;
  resultsTable.find('.result-val').each(function () {
    sum += parseFloat($(this).text());
  });
  resultsTable.find('.results-sum').text(sum.toFixed(decimals));
  resultsTable.find('.results-avg').text((sum / resultsTable.find('.result-val').length).toFixed(decimals));
}

//<editor-fold desc="Sort out default new vote form values">
(function () {
  var val;
  if (localStorage.getItem('new-vote-name')) {
    val = localStorage.getItem('new-vote-name');
  } else {
    var date = new Date
    //val = name + ' vote at ' + date.getHours() + ':' + date.getMinutes();
    val = 'Stop Loss Vote'; // at ' + String('00' + date.getHours()).slice(-2) + ':' + String('00' + date.getMinutes()).slice(-2);
  }
  newVoteNameInput.val(val);
  newVoteMinInput.val(localStorage.getItem('new-vote-min') ? localStorage.getItem('new-vote-min') : 5);
  newVoteMaxInput.val(localStorage.getItem('new-vote-max') ? localStorage.getItem('new-vote-max') : 15);
  newVoteStepInput.val(localStorage.getItem('new-vote-step') ? localStorage.getItem('new-vote-step') : 0.5);
}());
//</editor-fold>

//<editor-fold desc="Action: enter room">
socket.on('enter room', function (people) {
  $.each(people, function (k, u) {
    if (!$('.roomies li[data-id="' + u.guid + '"]').length) {
      addPersonToRoom(u.name, u.guid);
    }
  });
});
socket.emit('enter room', {guid: guid, name: name});
//</editor-fold>

socket.on('polls sync', function (polls) {
  polls.forEach(function (poll) {
    var haveIVoted = poll.votes.some(function (vote) {
      return vote.person.guid === guid;
    });
    createPoll(poll, haveIVoted);
    poll.votes.forEach(function (vote) {
      addVote(poll.uuid, vote.person.name, vote.vote);
    });
  });
});

//<editor-fold desc="Action: name change">
socket.on('name change', function (data) {
  var existingUser = $('.roomies li[data-id="' + data.guid + '"]');
  if (existingUser.length) {
    if (existingUser.find('a').length) {
      existingUser.find('a').text(data.name);
    } else {
      existingUser.text(data.name);
    }
  } else {
    addPersonToRoom(data.name, data.guid);
  }
});
//</editor-fold>

//<editor-fold desc="Action: person left">
socket.on('person left', function (id) {
  $('.roomies li[data-id="' + id + '"]').remove();
});
//</editor-fold>

//<editor-fold desc="Action: create poll">
$('#create-vote-button').on('tap', function (e) {
  var min = parseFloat(newVoteMinInput.val());
  var max = parseFloat(newVoteMaxInput.val());
  if (min >= max) {
    alert('Max must be more than Min.');
  }
  socket.emit('create poll', {
    name: newVoteNameInput.val(),
    min : min,
    max : max,
    step: newVoteStepInput.val()
  });
  $(".new-poll-area").collapsible("collapse");
});
socket.on('create poll', function (data) {
  createPoll(data);
});
//</editor-fold>

//<editor-fold desc="Action: vote">
socket.on('vote', function (data) {
  addVote(data.uuid, data.name, data.vote);
});
voteArea.delegate('.vote-button', 'tap', function () {
  var voteInstanceArea = $(this).closest('.vote-instance-area');
  var vote = voteInstanceArea.find('input[name=vote-input]').val();
  if (!$.isNumeric(vote)) {
    if (vote != '') {
      alert('Enter a number.');
    }
    return;
  }
  socket.emit('vote', {guid: guid, uuid: voteInstanceArea.attr('data-uuid'), vote: parseFloat(vote)});
  voteInstanceArea.find('.vote-instance-input-area').slideUp(400, function () {
    $(this).remove();
  });
  voteInstanceArea.find('table').removeClass('not-voted');
});
//</editor-fold>

//<editor-fold desc="Action: error">
socket.on('error', function (message) {
  alert(message);
});
//</editor-fold>
