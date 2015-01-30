var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var Room = function (name) {
  this._name = name;
  this._people = [];
  this._votes = [];
};
Room.prototype.addPerson = function (person) {
  this._people.push(person);
};
Room.prototype.removePerson = function (id) {
  this._people = this._people.filter(function (el) {
    return el.id !== id;
  });
};
Room.prototype.getPerson = function (id) {
  var person = null;
  this._people.some(function (el) {
    if (el.id === id) {
      person = el;
      return true;
    }
  });
  return person;
};
Room.prototype.getPeople = function () {
  return this._people;
};
Room.prototype.addVote = function (vote) {
  this._votes.push(vote);
};

var Person = function (socketId, name) {
  this.id = socketId;
  this.name = name;
};
Person.prototype.changeName = function (newName) {
  this.name = newName;
};

var Vote = function (name, min, max, step) {
  this.name = name;
  this.min = min;
  this.max = max;
  this.step = step;
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
    var person = boshRoom.getPerson(socket.id);
    if (person !== null) {
      person.changeName(name);
    } else {
      console.log('Could not find person with id ' + socket.id);
      console.log('in this room ');
      console.log(boshRoom);
    }
    io.emit('name change', {id: socket.id, name: name});
  });
  socket.on('create vote', function (data) {
    var vote = new Vote(data.name, data.min, data.max, data.step);
    boshRoom.addVote(vote);
    io.emit('create vote', data);
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