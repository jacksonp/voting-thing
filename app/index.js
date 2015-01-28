var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = {};

var votes = {};

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function (socket) {
  socket.on('name change', function (name) {
    users[socket.id] = name;
    io.emit('name change', {id: socket.id, name: name});
  });
  socket.on('enter room', function (name) {
    users[socket.id] = name;
    io.emit('enter room', users);
  });
  socket.on('vote', function (vote) {
    votes[socket.id] = vote;
    io.emit('vote', {id: socket.id, name: users[socket.id]});
    if (Object.keys(users).length === Object.keys(votes).length) {
      io.emit('results', {users: users, votes: votes});
      votes = {}; // clear votes
    }
  });
  socket.on('disconnect', function () {
    delete users[socket.id];
    io.emit('user left', socket.id);
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});