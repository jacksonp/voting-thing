'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var query = require('pg-query');
query.connectionParameters = 'postgres://vt@localhost/vt';

var Poll = require('./poll').Poll;

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
  res.sendFile('index.html', {root: __dirname + '/public/'});
});

io.on('connection', function (socket) {

  function emitToRoom (room, action, data) {
    query('SELECT socket_id FROM people WHERE room_id = vt_normalize($1)', [room], function (err, rows, result) {
      if (err) {
        console.error(err);
      } else {
        rows.forEach(function (r) {
          io.to(r.socket_id).emit(action, data);
        });
      }
    });
  }

  socket.on('enter room', function (data) {
    query('SELECT * FROM add_person_to_room($1, $2, $3, $4)', [data.room, data.name, data.uuid, socket.id], function (err, rows, result) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('error', err.messagePrimary);
      } else {
        var inRoom = [];
        rows.forEach(function (r) {
          inRoom.push({uuid: r.r_uuid, name: r.r_name});
        });
        rows.forEach(function (r) {
          io.to(r.r_socket_id).emit('enter room', inRoom);
        });
        query("SELECT poll_id, name, type, details, votes FROM polls WHERE room_id = vt_normalize($1)", [data.room], function (err, rows, result) {
          if (err) {
            console.error(err);
            io.to(socket.id).emit('error', err.messagePrimary);
          } else {
            io.to(socket.id).emit('polls sync', rows);
          }
        });
      }
    });
  });

  // TODO: maybe just use "enter room" for "name change" instead?
  //socket.on('name change', function (data) {
  //  var room, person;
  //  try {
  //    room = getRoom(data.room);
  //  } catch (e) {
  //    io.emit('error', e);
  //    return;
  //  }
  //  person = room.getPerson(data.);
  //  if (person === null) {
  //    // If the person wasn't in the room, just add them. Could happen with network issues?
  //    room.addPerson(new Person(socket.id, data., data.name));
  //  } else {
  //    // If the person is in the room, change their name.
  //    person.changeName(data.name);
  //  }
  //  io.emit('name change', {: data., name: data.name});
  //});

  socket.on('create poll', function (data) {
    var poll;
    try {
      poll = new Poll(data.name, data.type, data.details);
    } catch (e) {
      console.log(e);
      io.to(socket.id).emit('error', e);
      return;
    }
    query('SELECT create_poll($1, $2, $3, $4) AS poll_id', [data.room, poll.name, poll.type, poll.details], function (err, rows, result) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('error', err.messagePrimary);
      } else {
        poll.poll_id = rows[0].poll_id;
        emitToRoom(data.room, 'create poll', poll);
      }
    });
  });

  socket.on('vote', function (data) {
    query('SELECT vote($1, $2, $3, $4) AS name', [data.room, data.poll_id, data.uuid, data.vote], function (err, rows, result) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('error', err.messagePrimary);
      } else {
        emitToRoom(data.room, 'vote', {poll_id: data.poll_id, name: rows[0].name, vote: data.vote});
      }
    });
  });

  socket.on('disconnect', function () {
    console.log('Disconnnect.');
    //var room, person;
    //try {
    //  room = getRoom(data.room);
    //} catch (e) {
    //  io.emit('error', e);
    //  return;
    //}
    //boshRoom.removePerson(socket.id);
    //io.emit('person left', socket.id);
  });

});


http.listen(3000, function () {
  console.log('listening on *:3000');
});