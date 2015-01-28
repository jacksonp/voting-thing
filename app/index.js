var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = {};


app.get('/', function (req, res) {
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function (socket) {
  socket.on('name change', function (name) {
    console.log('name change');
    console.log(name);
    users[socket.id] = name;
    io.emit('name change', {id: socket.id, name: name});
  });
  socket.on('enter room', function (name) {
    users[socket.id] = name;
    io.emit('enter room', users);
  });
  socket.on('disconnect', function () {
    console.log('user disconnected');
    console.log(socket.id);
    delete users[socket.id];
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});