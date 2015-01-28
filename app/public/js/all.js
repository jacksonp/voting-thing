var socket = io();

var
  nameInput = $('#name-input'),
  voteInput = $('#vote-input'),
  name;

if (localStorage.getItem('name')) {
  name = localStorage.getItem('name');
} else {
  name = 'Anon';
}

nameInput.val(name);

nameInput.on('tap', function () {
  $(this).select();
});

socket.on('enter room', function (users) {
  $.each(users, function (id, name) {
    if (!$('.roomies li[data-id="' + id + '"]').length) {
      $('.roomies').append($('<li>').text(name).attr('data-id', id));
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
nameInput.change(function () {
  var newName = $(this).val().trim();
  localStorage.setItem('name', newName);
  socket.emit('name change', newName);
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
  var vote = $('#vote-input').val();
  if (!$.isNumeric(vote)) {
    alert('Enter a number.');
    return;
  }
  socket.emit('vote', vote);
  $('.vote-area').remove();
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
  html += '<button id="again-button">Again!</button>';
  $('.room-area').remove();
  $('.result-area').html(html);
  $('#again-button').on('tap', function (e) {
    location.reload();
  });

});