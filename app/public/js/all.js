var socket = io();

var
  voteInput = $('#vote-input'),
  voteArea = $('.vote-area'),
  name;

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

$('#my-name-button').on('tap', setName);

socket.on('enter room', function (users) {
  $.each(users, function (k, u) {
    if (!$('.roomies li[data-id="' + u.id + '"]').length) {
      $('.roomies').append($('<li>').text(u.name).attr('data-id', u.id));
    }
  });
});
socket.emit('enter room', name);

socket.on('name change', function (data) {
  var existingUser = $('.roomies li[data-id="' + data.id + '"]');
  if (existingUser.length) {
    existingUser.text(data.name);
  } else {
    $('.roomies').append($('<li>').text(data.name).attr('data-id', data.id));
  }
});

socket.on('user left', function (id) {
  $('.roomies li[data-id="' + id + '"]').remove();
});

socket.on('vote', function (data) {
  var existingUser = $('.roomies li[data-id="' + data.id + '"]');
  if (existingUser.length) {
    existingUser.addClass('voted');
  } else {
    // shouldn't happen:
    $('.roomies').append($('<li>').text(data.name).attr('data-id', data.id).addClass('voted'));
  }
});
$('#vote-button').on('tap', function (e) {
  var vote = voteInput.val();
  if (!$.isNumeric(vote)) {
    if (vote != '') {
      alert('Enter a number.');
    }
    return;
  }
  socket.emit('vote', vote);
  voteArea.hide();
  $('.result-area').text('You voted ' + vote);
});


socket.on('results', function (data) {
  var html = '<table data-role="table" class="ui-responsive"><thead><tr><th>Person</th><th>Vote</th></tr></thead><tbody>';
  var sum = 0;
  $.each(data.users, function (k, v) {
    vote = data.votes[k];
    html += '<tr><td>' + v + '</td><td class="num">' + vote + '</td></tr>';
    sum += parseFloat(vote);
  });
  html += '<tfoot><tr><th>Total</th><th class="num">' + sum + '</th></tr>';
  html += '<tr><th>Average</th><th class="num">' + (sum / Object.keys(data.users).length).toFixed(2) + '</th></tr></tfoot>';
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