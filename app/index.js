'use strict';

var io = require('engine.io').listen(3883);

var semver = require('semver');

var gcm = require('node-gcm');

var pollsPerQuery = 20;

var query = require('pg-query');
query.connectionParameters = 'postgres://vt@localhost/vt';


function pushNotifications (recipients, title, message, messageData) {
  messageData = messageData || {};
  messageData.title = title;
  messageData.message = message;
  //  messageData.msgcnt = 1;
  var messageObj = new gcm.Message({
    data: messageData
  });
  var sender = new gcm.Sender('***REMOVED***');
  sender.send(messageObj, recipients, function (err, result) {
    if (err) {
      console.error(err);
    }
  });
}

function getRegIdsStarred (room, excludeIds, callback) {

  var
    qStr = 'SELECT device_details FROM stars WHERE room_id = vt_normalize($1)',
    qData = [room];
  if (excludeIds.length) {
    qStr += ' AND device_id NOT IN ($2)';
    qData.push(excludeIds.join(','));
  }

  query(qStr, qData, function (err, rows) {
    if (err) {
      console.error(err);
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

var Poll = require('./poll').Poll;

function emit (socketId, action, data) {
  if (io.clients[socketId]) {
    io.clients[socketId].send(JSON.stringify({
      action: action,
      data  : data
    }));
  }
}

function emitError (socketId, message) {
  emit(socketId, 'vt_error', message);
}

function emitToRoom (room, action, data, callback) {
  query('SELECT socket_id, person_id FROM people WHERE room_id = vt_normalize($1)', [room], function (err, rows) {
    if (err) {
      console.error(err);
    } else {
      var peopleIds = [];
      rows.forEach(function (r) {
        emit(r.socket_id, action, data);
        peopleIds.push(r.person_id);
      });
      if (callback) {
        callback(peopleIds);
      }
    }
  });
}

function returnPolls (socketId, room, requestType, oldestPollId) {
  var
    sql = "SELECT poll_id, name AS poll_name, description, status, owner_id, type, details, votes, TO_CHAR(created, 'FMDD Mon') AS poll_date FROM polls WHERE room_id = vt_normalize($1)",
    sqlParams = [room, pollsPerQuery + 1];
  if (requestType === 'older polls') {
    sqlParams.push(oldestPollId);
    sql += " AND poll_id < $" + sqlParams.length;
  }
  sql += " ORDER BY poll_id DESC LIMIT $2";

  query(sql, sqlParams, function (err, rows) {
    if (err) {
      console.error(err);
      emitError(socketId, err.hint);
    } else {
      var moreAvailable = rows.length > pollsPerQuery;
      if (moreAvailable) {
        rows.pop();
      }
      emit(socketId, requestType, {
        polls         : rows,
        more_available: moreAvailable
      });
    }
  });
}

function enterRoom (room, name, personId, socketId) {

  query('SELECT * FROM add_person_to_room($1, $2, $3, $4)', [room, name, personId, socketId], function (err, rows) {
    if (err) {
      console.error(err);
      emitError(socketId, err.hint);
    } else {
      var i, inRoom = [];
      for (i = rows.length - 1; i >= 0; i--) {
        if (!io.clients[rows[i].r_socket_id]) { // No longer in room
          // TODO: fire and forget: not great. also dupe query for when leaving room.
          query('DELETE FROM people WHERE person_id = $1 AND room_id = vt_normalize($2)', [rows[i].r_person_id, room]);
          rows.splice(i, 1);
        } else {
          inRoom.push({person_id: rows[i].r_person_id, name: rows[i].r_name});
        }
      }
      rows.forEach(function (r) {
        emit(r.r_socket_id, 'enter room', inRoom);
      });
      returnPolls(socketId, room, 'polls sync');
      query('SELECT 1 FROM stars WHERE room_id = vt_normalize($1) AND device_id = $2', [room, personId], function (err, rows) {
        if (err) {
          console.error(err);
          emitError(socketId, err.hint);
        } else {
          var action = rows.length ? 'star' : 'unstar';
          emit(socketId, action, {message: ''}); // no message if pre-starred
        }
      });
    }
  });
}


function createPoll (socketId, room, name, pollName, description, personId, type, details) {
  var poll;
  try {
    poll = new Poll(pollName, description, personId, type, details);
  } catch (e) {
    console.error(e);
    emitError(socketId, e);
    return;
  }
  query('SELECT create_poll($1, $2, $3, $4, $5, $6) AS poll_id', [room, pollName, description, type, details, personId], function (err, rows) {
    if (err) {
      console.error(err);
      emitError(socketId, err.hint);
    } else {
      poll.poll_id = rows[0].poll_id;
      poll.status = 'open';
      emitToRoom(room, 'create poll', poll, function (peopleIdsEmittedTo) {
        // peopleIdsEmittedTo: don't do a push notification if user is in the room.
        getRegIdsStarred(room, peopleIdsEmittedTo, function (regIds) {
          pushNotifications(regIds, room + ': New Poll', pollName + ' - ' + name, {
            room     : room,
            poll_id  : poll.poll_id,
            poll_name: pollName,
            by       : name
          });
        });
      });
    }
  });
}

function vote (socketId, room, name, pollId, personId, vote) {
  query('SELECT * FROM vote($1, $2, $3, $4)', [room, pollId, personId, {vote: vote}], function (err, rows) {
    if (err) {
      console.error(err);
      emitError(socketId, err.hint);
    } else {
      var pollName = rows[0].poll_name;
      emitToRoom(room, 'vote', {
        poll_id: pollId,
        vote   : {vote: vote, name: rows[0].person_name, person_id: personId}
      }, function (peopleIdsEmittedTo) {
        // peopleIdsEmittedTo: don't do a push notification if user is in the room.
        getRegIdsStarred(room, peopleIdsEmittedTo, function (regIds) {
          pushNotifications(regIds, room + ' - ' + pollName, name + ' voted', {
            room     : room,
            poll_id  : pollId,
            poll_name: pollName,
            voter    : name
          });
        });
      });
    }
  });
}

io.on('connection', function (socket) {

  socket.on('message', function (data) {

    var payload = JSON.parse(data);

    if (!io.clients[socket.id]) {
      console.error('Do not know who we got the message from:');
      console.error(socket.id);
      console.error(data);
      return;
    }
    if (!payload.v || semver.lt(payload.v, '0.5.0')) {
      emitError(socket.id, 'Please update this app.');
      return;
    }
    if (!payload.action) {
      console.error('No action received in following data:');
      console.error(data);
      return;
    }
    switch (payload.action) {
      case 'enter room':
        enterRoom(payload.room, payload.name, payload.person_id, socket.id);
        break;
      case 'create poll':
        createPoll(socket.id, payload.room, payload.name, payload.poll_name, payload.description, payload.person_id, payload.type, payload.details);
        break;
      case 'vote':
        vote(socket.id, payload.room, payload.name, payload.poll_id, payload.person_id, payload.vote);
        break;
      case 'older polls':
        returnPolls(socket.id, payload.room, 'older polls', payload.oldest_poll_id);
        break;
      case 'name change':
        query("UPDATE people SET name = $2 WHERE person_id = $1 RETURNING room_id", [payload.person_id, payload.new_name], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            rows.forEach(function (r) {
              emitToRoom(r.room_id, 'name change', payload);
            });
          }
        });
        break;
      case 'close poll':
        query('UPDATE polls SET status = $2 WHERE poll_id = $1', [payload.poll_id, 'closed'], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emitToRoom(payload.room, 'close poll', payload.poll_id);
          }
        });
        break;
      case 'reopen poll':
        query('UPDATE polls SET status = $2 WHERE poll_id = $1', [payload.poll_id, 'open'], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emitToRoom(payload.room, 'reopen poll', payload.poll_id);
          }
        });
        break;
      case 'delete poll':
        query('DELETE FROM polls WHERE poll_id = $1', [payload.poll_id], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emitToRoom(payload.room, 'delete poll', payload.poll_id);
          }
        });
        break;
      case 'leave room':
        query('DELETE FROM people WHERE person_id = $1 AND room_id = vt_normalize($2)', [payload.person_id, payload.room], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emitToRoom(payload.room, 'person left', payload.person_id);
          }
        });
        break;
      case 'star':
        query('SELECT star($1, $2, $3)', [payload.room, payload.person_id, {
          model                  : payload.device_model,
          manufacturer           : payload.device_manufacturer,
          version                : payload.device_version,
          platform               : payload.device_platform,
          android_registration_id: payload.android_registration_id
        }], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emit(socket.id, 'star', {message: payload.room + ': poll and vote notifications on.'});
          }
        });
        break;
      case 'unstar':
        query('DELETE FROM stars WHERE room_id = vt_normalize($1) AND device_id = $2', [payload.room, payload.person_id], function (err, rows) {
          if (err) {
            console.error(err);
            emitError(socket.id, err.hint);
          } else {
            emit(socket.id, 'unstar', {message: payload.room + ': notifications off.'});
          }
        });
        break;
      default:
        console.error('Unrecognised action received in following data:');
        console.error(data);
        return;
    }

  });

  socket.on('close', function () {
    query('DELETE FROM people WHERE socket_id = $1 RETURNING room_id, person_id', [socket.id], function (err, rows) {
      if (err) {
        console.error(err);
        emitError(socket.id, err.hint);
      } else {
        rows.forEach(function (r) {
          emitToRoom(r.room_id, 'person left', r.person_id);
        });
      }
    });
  });


});