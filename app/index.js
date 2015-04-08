'use strict';

var io = require('socket.io').listen(3883);

var gcm = require('node-gcm');

function pushNotifications (recipients, title, message, messageData) {
  messageData = messageData || {};
  messageData.title = title;
  messageData.message = message;
  //  messageData.msgcnt = 1;
  var message = new gcm.Message({
    data: messageData
  });
  var sender = new gcm.Sender('***REMOVED***');
  sender.send(message, recipients, function (err, result) {
    if (err) {
      console.error(err);
    }
  });
}

function getRegIdsStarred (room, excludeId, callback) {
  query('SELECT device_details FROM stars WHERE room_id = vt_normalize($1) AND device_id != $2', [room, excludeId], function (err, rows) {
    if (err) {
      console.log(err);
    } else {
      var regIds = [];
      rows.forEach(function (r) {
        regIds.push(r.device_details.android_registration_id);
      });
      if (regIds.length) {
        callback(regIds);
      }
    }
  });
}

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

  function returnPolls (socketId, room, requestType, oldestPollId) {
    var
      sql = "SELECT poll_id, name AS poll_name, description, status, owner_id, type, details, votes FROM polls WHERE room_id = vt_normalize($1)",
      sqlParams = [room, pollsPerQuery + 1];
    if (requestType === 'older polls') {
      sqlParams.push(oldestPollId);
      sql += " AND poll_id < $" + sqlParams.length;
    }
    sql += " ORDER BY poll_id DESC LIMIT $2";

    query(sql, sqlParams, function (err, rows) {
      if (err) {
        console.error(err);
        io.to(socketId).emit('vt_error', err.hint);
      } else {
        var moreAvailable = rows.length > pollsPerQuery;
        if (moreAvailable) {
          rows.pop();
        }
        io.to(socketId).emit(requestType, {
          polls         : rows,
          more_available: moreAvailable
        });
      }
    });
  }

  socket.on('enter room', function (data) {
    if (!data.v) {
      io.to(socket.id).emit('vt_error', 'Please update this app to version 0.3.1 or greater.');
      return;
    }

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
        returnPolls(socket.id, data.room, 'polls sync');
        query('SELECT 1 FROM stars WHERE room_id = vt_normalize($1) AND device_id = $2', [data.room, data.person_id], function (err, rows) {
          if (err) {
            console.log(err);
            io.to(socket.id).emit('vt_error', err.hint);
          } else {
            var action = rows.length ? 'star' : 'unstar';
            io.to(socket.id).emit(action, {message: ''}); // no message if pre-starred
          }
        });
      }
    });
  });

  socket.on('older polls', function (data) {
    returnPolls(socket.id, data.room, 'older polls', data.oldest_poll_id);
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
      poll = new Poll(data.poll_name, data.description, data.person_id, data.type, data.details);
    } catch (e) {
      console.log(e);
      io.to(socket.id).emit('vt_error', e);
      return;
    }
    query('SELECT create_poll($1, $2, $3, $4, $5, $6) AS poll_id', [data.room, poll.poll_name, poll.description, poll.type, poll.details, data.person_id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        poll.poll_id = rows[0].poll_id;
        poll.status = 'open';
        emitToRoom(data.room, 'create poll', poll);

        getRegIdsStarred(data.room, data.person_id, function (regIds) {
          pushNotifications(regIds, data.room + ': New Poll', poll.poll_name + ' - ' + data.name, {
            room     : data.room,
            poll_id  : poll.poll_id,
            poll_name: poll.poll_name,
            by       : data.name
          });
        });

      }
    });
  });

  socket.on('close poll', function (data) {
    query('UPDATE polls SET status = $2 WHERE poll_id = $1', [data.poll_id, 'closed'], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        emitToRoom(data.room, 'close poll', data.poll_id);
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
    query('SELECT * FROM vote($1, $2, $3, $4)', [data.room, data.poll_id, data.person_id, {vote: data.vote}], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        var pollName = rows[0].poll_name;
        emitToRoom(data.room, 'vote', {
          poll_id: data.poll_id,
          vote   : {vote: data.vote, name: rows[0].person_name, person_id: data.person_id}
        });

        getRegIdsStarred(data.room, data.person_id, function (regIds) {
          pushNotifications(regIds, data.room + ' - ' + pollName, data.name + ' voted', {
            room     : data.room,
            poll_id  : data.poll_id,
            poll_name: pollName,
            voter    : data.name
          });
        });

      }
    });
  });

  socket.on('leave room', function (data) {
    query('DELETE FROM people WHERE person_id = $1 AND room_id = vt_normalize($2)', [data.person_id, data.room], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        emitToRoom(data.room, 'person left', data.person_id);
      }
    });
  });

  socket.on('star', function (data) {
    query('SELECT star($1, $2, $3)', [data.room, data.person_id, {
      model                  : data.device_model,
      manufacturer           : data.device_manufacturer,
      version                : data.device_version,
      platform               : data.device_platform,
      android_registration_id: data.android_registration_id
    }], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        io.to(socket.id).emit('star', {message: data.room + ': poll and vote notifications on.'});
      }
    });
  });

  socket.on('unstar', function (data) {
    query('DELETE FROM stars WHERE room_id = vt_normalize($1) AND device_id = $2', [data.room, data.person_id], function (err, rows) {
      if (err) {
        console.log(err);
        io.to(socket.id).emit('vt_error', err.hint);
      } else {
        io.to(socket.id).emit('unstar', {message: data.room + ': notifications off.'});
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