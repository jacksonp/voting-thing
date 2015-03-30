'use strict';

var io = require('socket.io').listen(3883);

var pollsPerQuery = 20;

var query = require('pg-query');
query.connectionParameters = 'postgres://vt@localhost/vt';

var Poll = require('./poll').Poll;

io.on('connection', function (socket) {

  function emitToRoom (room, action, data) {
    query('SELECT socket_id FROM people WHERE room_id = vt_normalize($1)', [room], function (err, rows) {
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
    query('SELECT * FROM add_person_to_room($1, $2, $3, $4)', [data.room, data.name, data.person_id, socket.id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        var inRoom = [];
        rows.forEach(function (r) {
          inRoom.push({person_id: r.r_person_id, name: r.r_name});
        });
        rows.forEach(function (r) {
          io.to(r.r_socket_id).emit('enter room', inRoom);
        });
        query("SELECT poll_id, name AS poll_name, owner_id, type, details, votes FROM polls WHERE room_id = vt_normalize($1) ORDER BY poll_id DESC LIMIT $2", [data.room, pollsPerQuery + 1], function (err, rows) {
          if (err) {
            console.error(err);
            io.to(socket.id).emit('vt_error', err.hint);
          } else {
            var moreAvailable = rows.length > pollsPerQuery;
            if (moreAvailable) {
              rows.pop();
            }
            io.to(socket.id).emit('polls sync', {
              polls: rows,
              more_available: moreAvailable
            });
          }
        });
      }
    });
  });

  socket.on('older polls', function (data) {
    console.log(data);
    query("SELECT poll_id, name AS poll_name, owner_id, type, details, votes FROM polls WHERE room_id = vt_normalize($1) AND poll_id < $2 ORDER BY poll_id DESC LIMIT $3", [data.room, data.oldest_poll_id, pollsPerQuery + 1], function (err, rows) {
      if (err) {
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        var moreAvailable = rows.length > pollsPerQuery;
        if (moreAvailable) {
          rows.pop();
        }
        io.to(socket.id).emit('older polls', {
          polls: rows,
          more_available: moreAvailable
        });
      }
    });
  });

  socket.on('name change', function (data) {
    query("UPDATE people SET name = $2 WHERE person_id = $1 RETURNING room_id", [data.person_id, data.new_name], function (err, rows) {
      if (err) {
        console.error(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        rows.forEach(function (r) {
          emitToRoom(r.room_id, 'name change', data);
        });
      }
    });
  });

  socket.on('create poll', function (data) {
    var poll;
    try {
      poll = new Poll(data.poll_name, data.person_id, data.type, data.details);
    } catch (e) {
      console.log(e);
      io.to(socket.id).emit('vt_error', e);
      return;
    }
    query('SELECT create_poll($1, $2, $3, $4, $5) AS poll_id', [data.room, poll.poll_name, poll.type, poll.details, data.person_id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        poll.poll_id = rows[0].poll_id;
        emitToRoom(data.room, 'create poll', poll);
      }
    });
  });

  socket.on('delete poll', function (data) {
    query('DELETE FROM polls WHERE poll_id = $1', [data.poll_id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        emitToRoom(data.room, 'delete poll', data.poll_id);
      }
    });
  });

  socket.on('vote', function (data) {
    query('SELECT vote($1, $2, $3, $4) AS name', [data.room, data.poll_id, data.person_id, {vote: data.vote}], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        emitToRoom(data.room, 'vote', {
          poll_id: data.poll_id,
          vote   : {vote: data.vote, name: rows[0].name, person_id: data.person_id}
        });
      }
    });
  });

  socket.on('leave room', function (data) {
    query('DELETE FROM people WHERE person_id = $1 AND room_id = $2', [data.person_id, data.room], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        emitToRoom(data.room, 'person left', data.person_id);
      }
    });
  });

  socket.on('disconnect', function () {
    query('DELETE FROM people WHERE socket_id = $1 RETURNING room_id, person_id', [socket.id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        rows.forEach(function (r) {
          emitToRoom(r.room_id, 'person left', r.person_id);
        });
      }
    });
  });

});