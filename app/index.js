var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var Room = function (name) {
  this._name = name;
  this._people = [];
};
Room.prototype.addPerson = function (person) {
  this._people.push(person);
};
Room.prototype.removePerson = function (id) {
  this._people.forEach(function (el) {
    if (el.id !== id) {
      return el;
    }
  });
};
Room.prototype.getPerson = function (id) {
  this._people = this._people.filter(function (el) {
    return el.id !== id;
  });
};
Room.prototype.getPeople = function () {
  return this._people;
};

var Person = function (socketId, name) {
  this.id = socketId;
  this.name = name;
};
Person.prototype.changeName = function (newName) {
  this.name = newName;
};

var Vote = function (name) {
  this._name = name;
};

var boshRoom = new Room('bosh');

var users = {};

var votes = {};

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function (socket) {
  socket.on('enter room', function (name) {
    boshRoom.addPerson(new Person(socket.id, name));
    io.emit('enter room', boshRoom.getPeople());
  });
  socket.on('name change', function (name) {
    boshRoom.getPerson(socket.id).changeName(name);
    io.emit('name change', {id: socket.id, name: name});
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
    boshRoom.removePerson(socket.id);
    io.emit('user left', socket.id);
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});