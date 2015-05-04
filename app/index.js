'use strict';

var io = require('engine.io').listen(3883);

var semver = require('semver');

var gcm = require('node-gcm');

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

function vtError (socketId, message) {
  io.clients[socketId].send(JSON.stringify({
    action : 'vt_error',
    message: message
  }));
}

function emit (socketId, action, data) {
  io.clients[socketId].send(JSON.stringify({
    action: action,
    data  : data
  }));
}

function emitToRoom (room, action, data) {
  query('SELECT socket_id FROM people WHERE room_id = vt_normalize($1)', [room], function (err, rows) {
    if (err) {
      console.error(err);
    } else {
      rows.forEach(function (r) {
        emit(r.socket_id, action, data);
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
      vtError(socketId, err.hint);
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
      console.log(err);
      vtError(socketId, err.hint);
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
          console.log(err);
          vtError(socketId, err.hint);
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
    console.log(e);
    vtError(socketId, e);
    return;
  }
  query('SELECT create_poll($1, $2, $3, $4, $5, $6) AS poll_id', [room, pollName, description, type, details, personId], function (err, rows) {
    if (err) {
      console.log(err);
      vtError(socketId, err.hint);
    } else {
      poll.poll_id = rows[0].poll_id;
      poll.status = 'open';
      emitToRoom(room, 'create poll', poll);

      getRegIdsStarred(room, personId, function (regIds) {
        pushNotifications(regIds, room + ': New Poll', pollName + ' - ' + name, {
          room     : room,
          poll_id  : poll.poll_id,
          poll_name: pollName,
          by       : name
        });
      });

    }
  });
}

function vote (socketId, room, name, pollId, personId, vote) {
  query('SELECT * FROM vote($1, $2, $3, $4)', [room, pollId, personId, {vote: vote}], function (err, rows) {
    if (err) {
      console.log(err);
      vtError(socketId, err.hint);
    } else {
      var pollName = rows[0].poll_name;
      emitToRoom(room, 'vote', {
        poll_id: pollId,
        vote   : {vote: vote, name: rows[0].person_name, person_id: personId}
      });

      getRegIdsStarred(room, personId, function (regIds) {
        pushNotifications(regIds, room + ' - ' + pollName, name + ' voted', {
          room     : room,
          poll_id  : pollId,
          poll_name: pollName,
          voter    : name
        });
      });

    }
  });
}

io.on('connection', function (socket) {

  socket.on('message', function (data) {

    console.log('engine.io message');
    var receivedData = JSON.parse(data);
    console.log(receivedData);
    if (!io.clients[socket.id]) {
      console.error('Do not know who we got the message from:');
      console.error(socket.id);
      console.error(data);
      return;
    }
    if (!receivedData.v || semver.lt(receivedData.v, '0.4.2')) {
      vtError(socket.id, 'Please update this app.');
      return;
    }
    if (!receivedData.action) {
      console.error('No action received in following data:');
      console.error(data);
      return;
    }
    switch (receivedData.action) {
      case 'enter room':
        enterRoom(receivedData.room, receivedData.name, receivedData.person_id, socket.id);
        break;
      case 'create poll':
        createPoll(socket.id, receivedData.room, receivedData.name, receivedData.poll_name, receivedData.description, receivedData.person_id, receivedData.type, receivedData.details);
        break;
      case 'vote':
        vote(socket.id, receivedData.room, receivedData.name, receivedData.poll_id, receivedData.person_id, receivedData.vote);
        break;
      case 'older polls':
        returnPolls(socket.id, receivedData.room, 'older polls', receivedData.oldest_poll_id);
        break;
      case 'name change':
        query("UPDATE people SET name = $2 WHERE person_id = $1 RETURNING room_id", [receivedData.person_id, receivedData.new_name], function (err, rows) {
          if (err) {
            console.error(err);
            vtError(socket.id, err.hint);
          } else {
            rows.forEach(function (r) {
              emitToRoom(r.room_id, 'name change', receivedData);
            });
          }
        });
        break;
      case 'close poll':
        query('UPDATE polls SET status = $2 WHERE poll_id = $1', [receivedData.poll_id, 'closed'], function (err, rows) {
          if (err) {
            console.log(err);
            vtError(socket.id, err.hint);
          } else {
            emitToRoom(receivedData.room, 'close poll', receivedData.poll_id);
          }
        });
        break;
      case 'delete poll':
        query('DELETE FROM polls WHERE poll_id = $1', [receivedData.poll_id], function (err, rows) {
          if (err) {
            console.log(err);
            vtError(socket.id, err.hint);
          } else {
            emitToRoom(receivedData.room, 'delete poll', receivedData.poll_id);
          }
        });
        break;
      case 'leave room':
        query('DELETE FROM people WHERE person_id = $1 AND room_id = vt_normalize($2)', [receivedData.person_id, receivedData.room], function (err, rows) {
          if (err) {
            console.log(err);
            vtError(socket.id, err.hint);
          } else {
            emitToRoom(receivedData.room, 'person left', receivedData.person_id);
          }
        });
        break;
      case 'star':
        query('SELECT star($1, $2, $3)', [receivedData.room, receivedData.person_id, {
          model                  : receivedData.device_model,
          manufacturer           : receivedData.device_manufacturer,
          version                : receivedData.device_version,
          platform               : receivedData.device_platform,
          android_registration_id: receivedData.android_registration_id
        }], function (err, rows) {
          if (err) {
            console.log(err);
            vtError(socket.id, err.hint);
          } else {
            emit(socket.id, 'star', {message: receivedData.room + ': poll and vote notifications on.'});
          }
        });
        break;
      case 'unstar':
        query('DELETE FROM stars WHERE room_id = vt_normalize($1) AND device_id = $2', [receivedData.room, receivedData.person_id], function (err, rows) {
          if (err) {
            console.log(err);
            vtError(socket.id, err.hint);
          } else {
            emit(socket.id, 'unstar', {message: data.room + ': notifications off.'});
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
    console.log('engine.io close');
    query('DELETE FROM people WHERE socket_id = $1 RETURNING room_id, person_id', [socket.id], function (err, rows) {
      if (err) {
        console.log(err);
        vtError(socket.id, err.hint);
      } else {
        rows.forEach(function (r) {
          emitToRoom(r.room_id, 'person left', r.person_id);
        });
      }
    });
  });


});