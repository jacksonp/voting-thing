var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var Person = require('./person');
var Vote = require('./vote');
var Room = require('./room');

var boshRoom = new Room('bosh');

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
    if (person === null) {
      // If the person wasn't in the room, just add them. Could happen with network issues?
      boshRoom.addPerson(new Person(socket.id, name));
    } else {
      // If the person is in the room, change their name.
      person.changeName(name);
    }
    io.emit('name change', {id: socket.id, name: name});
  });
  socket.on('create vote', function (data) {
    var vote = new Vote(data.name, data.min, data.max, data.step);
    boshRoom.addVote(vote);
    data.uuid = vote.uuid;
    data.decimals = vote.decimals;
    io.emit('create vote', data);
  });
  socket.on('vote', function (data) {
    var vote = boshRoom.getVote(data.uuid);
    if (vote === null) {
      io.emit('error', 'Ballot not found.');
      return;
    }
    var votingPerson = boshRoom.getPerson(socket.id);
    if (votingPerson === null) {
      io.emit('error', 'Voter not found.');
      return;
    }
    vote.addVote(votingPerson, data.vote);
    var votes = vote.getVotes();
    io.emit('vote', {uuid: data.uuid, name: votingPerson.name, vote: data.vote});

    // Keep it simpler than this to start with:
    //votes.forEach(function (v) { // people who have voted get new votes as they come in.
    //  io.sockets.connected[v.person.id].emit('vote', {uuid: data.uuid, name: votingPerson.name, vote: data.vote});
    //});
    //// person who has just voted gets all votes so far.
  });
  socket.on('disconnect', function () {
    boshRoom.removePerson(socket.id);
    io.emit('person left', socket.id);
  });
});

http.listen(3000, function () {
  console.log('listening on *:3000');
});