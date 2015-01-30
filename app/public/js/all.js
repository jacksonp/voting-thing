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

//<editor-fold desc="Sort out default new vote form values">
(function () {
  var val;
  if (localStorage.getItem('new-vote-name')) {
    val = localStorage.getItem('new-vote-name');
  } else {
    var date = new Date
    //val = name + ' vote at ' + date.getHours() + ':' + date.getMinutes();
    val = 'Stop loss vote at ' + date.getHours() + ':' + date.getMinutes();
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
      roomArea.append($('<li>').text(u.name).attr('data-id', u.id));
      roomArea.listview('refresh');
    }
  });
});
socket.emit('enter room', name);
//</editor-fold>

//<editor-fold desc="Action: name change">
socket.on('name change', function (data) {
  var existingUser = $('.roomies li[data-id="' + data.id + '"]');
  if (existingUser.length) {
    existingUser.text(data.name);
  } else {
    roomArea.append($('<li>').text(data.name).attr('data-id', data.id));
    roomArea.listview('refresh');
  }
});
$('#my-name-button').on('tap', setName);
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
});
function hideCreateVoteArea () {
  newVoteArea.hide();
  newVoteButton.show();
}
$('#cancel-create-vote-button').on('tap', function (e) {
  hideCreateVoteArea();
});
$('#create-vote-button').on('tap', function (e) {
  socket.emit('create vote', {
    name: newVoteNameInput.val(),
    min : newVoteMinInput.val(),
    max : newVoteMaxInput.val(),
    step: newVoteStepInput.val()
  });
  hideCreateVoteArea();
});
socket.on('create vote', function (data) {
  html = '<div class="vote-instance-area" data-uuid="' + data.uuid + '">';
  html += '<h2>' + data.name + '</h2>';
  html += '<div class="vote-instance-input-area">';
  html += '<input name="vote-input" value="' + data.min + '" min="' + data.min + '" max="' + data.max + '" step="' + data.step + '" type="range">';
  html += '<button class="vote-button">Send My Vote</button>';
  html += '</div>';
  html += '<div class="vote-instance-result-area">';
  html += '<table data-role="table" class="ui-responsive"><thead><tr><th>Person</th><th>Vote</th></tr></thead><tbody>';
  html += '</tbody></table>';
  html += '</div>';
  html += '</div>';
  voteArea.prepend(html).enhanceWithin();
});
//</editor-fold>


socket.on('vote', function (data) {
  var voteInstanceResultArea = $('.vote-instance-area[data-uuid=' + data.uuid + '] .vote-instance-result-area');
  voteInstanceResultArea.show();
  var resultsTable = voteInstanceResultArea.find('table');
  resultsTable.find('tbody').append('<tr><td>' + data.name + '</td><td class="num">' + data.vote + '</td></tr>');

  //var existingUser = $('.roomies li[data-id="' + data.id + '"]');
  //if (existingUser.length) {
  //  existingUser.addClass('voted');
  //} else {
  //  // shouldn't happen:
  //  $('.roomies').append($('<li>').text(data.name).attr('data-id', data.id).addClass('voted'));
  //}
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
  socket.emit('vote', {uuid: voteInstanceArea.attr('data-uuid'), vote: vote});
  voteInstanceArea.find('.vote-instance-input-area').remove();
  //voteInstanceArea.find('.vote-instance-result-area').text('You voted ' + vote);
});

socket.on('results', function (data) {
  var html = '<table data-role="table" class="ui-responsive"><thead><tr><th>Person</th><th>Vote</th></tr></thead><tbody>';
  var sum = 0;
  $.each(data.people, function (k, v) {
    vote = data.votes[k];
    html += '<tr><td>' + v + '</td><td class="num">' + vote + '</td></tr>';
    sum += parseFloat(vote);
  });
  html += '<tfoot><tr><th>Total</th><th class="num">' + sum + '</th></tr>';
  html += '<tr><th>Average</th><th class="num">' + (sum / Object.keys(data.people).length).toFixed(2) + '</th></tr></tfoot>';
  html += '</tbody></table>';
  $('.room-area').hide();
  $('.result-area').html(html);
  setTimeout(function () {
    $('#again-button').show().on('tap', function (e) {
      $(this).hide();
      voteInput.val('');
      $('.roomies .voted').removeClass('voted');
      $('.result-area').html('');
      voteArea.show();
      $('.room-area').show();
    });
  }, 5000);
});