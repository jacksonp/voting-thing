var socket = io();

var
  name,
  newVoteNameInput = $('#new-vote-name'),
  newVoteMinInput  = $('#new-vote-min'),
  newVoteMaxInput  = $('#new-vote-max'),
  newVoteStepInput = $('#new-vote-step'),
  newVoteButton    = $('#new-vote-button'),
  newVoteArea      = $('.new-vote-area'),
  voteArea         = $('.vote-area'),
  roomArea         = $('.roomies');


//<editor-fold desc="Sort out name">
function setName () {
  res = window.prompt("What is your name?", name);
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
    socket.emit('name change', name);
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
  if (id === socket.io.engine.id) {
    li.attr('data-icon', 'edit').append($('<a>').addClass('my-name').text(name)).on('tap', setName);
  } else {
    li.text(name);
  }
  roomArea.append(li);
  roomArea.listview('refresh');
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
    if (!$('.roomies li[data-id="' + u.id + '"]').length) {
      addPersonToRoom(u.name, u.id);
    }
  });
});
socket.emit('enter room', name);
//</editor-fold>

//<editor-fold desc="Action: name change">
socket.on('name change', function (data) {
  var existingUser = $('.roomies li[data-id="' + data.id + '"]');
  if (existingUser.length) {
    if (existingUser.find('a').length) {
      existingUser.find('a').text(data.name);
    } else {
      existingUser.text(data.name);
    }
  } else {
    addPersonToRoom(data.name, dataid);
  }
});
//</editor-fold>

//<editor-fold desc="Action: person left">
socket.on('person left', function (id) {
  $('.roomies li[data-id="' + id + '"]').remove();
});
//</editor-fold>

//<editor-fold desc="Action: create vote">
newVoteButton.on('tap', function (e) {
  $(this).hide();
  newVoteArea.show();
  newVoteNameInput.select();
});
function hideCreateVoteArea () {
  newVoteArea.hide();
  newVoteButton.show();
}
$('#cancel-create-vote-button').on('tap', function (e) {
  hideCreateVoteArea();
});
$('#create-vote-button').on('tap', function (e) {
  var min = parseFloat(newVoteMinInput.val());
  var max = parseFloat(newVoteMaxInput.val());
  if (min >= max) {
    alert('Max must be more than Min.');
  }
  socket.emit('create vote', {
    name: newVoteNameInput.val(),
    min : min,
    max : max,
    step: newVoteStepInput.val()
  });
  hideCreateVoteArea();
});
socket.on('create vote', function (data) {
  html = '<div class="vote-instance-area" data-uuid="' + data.uuid + '">';
  html += '<h2>' + data.name + '</h2>';
  html += '<div class="vote-instance-input-area">';
  html += '<input name="vote-input" value="' + (data.min + ((data.max - data.min) / 2)) + '" min="' + data.min + '" max="' + data.max + '" step="' + data.step + '" type="range">';
  html += '<button class="vote-button">Send My Vote</button>';
  html += '</div>';
  html += '<div class="vote-instance-result-area" data-decimals="' + data.decimals + '">';
  html += '<table class="vote-results-table not-voted"><thead><tr><th>Person</th><th>Vote</th></tr></thead><tbody></tbody>';
  html += '<tfoot><tr><th>Total</th><th class="results-sum num"></th></tr>';
  html += '<tr><th>Average</th><th class="results-avg num"></th></tr></tfoot>';
  html += '</table>';
  html += '</div>';
  html += '</div>';
  voteArea.prepend(html).enhanceWithin();
});
//</editor-fold>

//<editor-fold desc="Action: vote">
socket.on('vote', function (data) {
  var voteInstanceResultArea = $('.vote-instance-area[data-uuid=' + data.uuid + '] .vote-instance-result-area');
  var decimals = voteInstanceResultArea.attr('data-decimals');
  voteInstanceResultArea.show();
  var resultsTable = voteInstanceResultArea.find('table');
  resultsTable.find('tbody').append('<tr><td>' + data.name + '</td><td class="num result-val">' + data.vote.toFixed(decimals) + '</td></tr>');
  var sum = 0;
  resultsTable.find('.result-val').each(function () {
    sum += parseFloat($(this).text());
  });
  resultsTable.find('.results-sum').text(sum.toFixed(decimals));
  resultsTable.find('.results-avg').text((sum / resultsTable.find('.result-val').length).toFixed(decimals));
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
  socket.emit('vote', {uuid: voteInstanceArea.attr('data-uuid'), vote: parseFloat(vote)});
  voteInstanceArea.find('.vote-instance-input-area').remove();
  voteInstanceArea.find('table').removeClass('not-voted');
});
//</editor-fold>

//<editor-fold desc="Action: error">
socket.on('error', function (message) {
  alert(message);
});
//</editor-fold>
