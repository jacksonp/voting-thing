var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = {};


app.get('/', function(req, res){
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function(socket){
  socket.on('name change', function(data){
    console.log('name change');
    console.log(data);
    users[data.guid] = data.name;
  });
  socket.on('enter room', function(data){
    console.log('enter room');
    console.log(data);
    users[data.guid] = data.name;
    io.emit('enter room', data);
  });
  socket.on('disconnect', function(){
    console.log('user disconnected');
    console.log(socket.id);
    // delete users[guid]
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});