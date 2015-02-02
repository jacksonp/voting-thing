'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var Person = require('./person');
var Poll = require('./poll');
var Room = require('./room');

var boshRoom = new Room('bosh');

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function (socket) {
  socket.on('enter room', function (name) {
    boshRoom.addPerson(new Person(socket.id, name));
    io.to(socket.id).emit('polls sync', boshRoom.getPolls());
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
  socket.on('create poll', function (data) {
    var poll = new Poll(data.name, data.min, data.max, data.step);
    boshRoom.addPoll(poll);
    io.emit('create poll', poll);
  });
  socket.on('vote', function (data) {
    var poll = boshRoom.getPoll(data.uuid);
    if (poll === null) {
      io.emit('error', 'Poll not found.');
      return;
    }
    var votingPerson = boshRoom.getPerson(socket.id);
    if (votingPerson === null) {
      io.emit('error', 'Poll not found.');
      return;
    }
    poll.addVote(votingPerson, data.vote);
    //var votes = poll.getVotes();
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