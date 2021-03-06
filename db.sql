-- createuser -d -U postgres vt
-- createdb -U vt vt
-- psql -U postgres vt
-- vt=# CREATE EXTENSION unaccent;
-- psql -U vt

CREATE TABLE rooms (
  room_id TEXT PRIMARY KEY, -- normalized name
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name    TEXT                     NOT NULL
);

-- Actually: "devices currently in a room".
CREATE TABLE people (
  room_id   TEXT REFERENCES rooms ON UPDATE CASCADE ON DELETE CASCADE,
  person_id TEXT                     NOT NULL,
  created   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name      TEXT                     NOT NULL,
  socket_id TEXT                     NOT NULL,
  PRIMARY KEY (room_id, person_id)
);

CREATE TABLE stars (
  room_id        TEXT                     NOT NULL REFERENCES rooms ON UPDATE CASCADE ON DELETE CASCADE,
  device_id      TEXT                     NOT NULL, --same as people.person_id
  entered        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  device_details JSON                     NOT NULL,
  PRIMARY KEY (room_id, device_id)
);

CREATE TABLE polls (
  poll_id  SERIAL PRIMARY KEY,
  room_id  TEXT                     NOT NULL REFERENCES rooms ON UPDATE CASCADE ON DELETE CASCADE,
  created  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name     TEXT                     NOT NULL,
  status   TEXT                     NOT NULL DEFAULT 'open',
  owner_id TEXT                     NOT NULL,
  type     TEXT                     NOT NULL,
  details  JSON                     NOT NULL,
  votes    JSON                     NOT NULL DEFAULT '{}'
);


CREATE OR REPLACE FUNCTION vt_normalize(TEXT)
  RETURNS TEXT AS
$func$
SELECT REGEXP_REPLACE(
    REGEXP_REPLACE(
        REPLACE(
            LOWER(
                UNACCENT(
                    TRIM($1)
                )
            ), ' ', '-'
        ), '[^0-9a-z-]', '', 'g'
    ), E'-+', '-', 'g'
);
$func$
LANGUAGE SQL
IMMUTABLE
RETURNS NULL ON NULL INPUT;


CREATE OR REPLACE FUNCTION get_room(p_param1 rooms.name%TYPE)
  RETURNS rooms.room_id%TYPE AS $func$
DECLARE
  norm_name TEXT := vt_normalize(p_param1);
  v_id      rooms.room_id%TYPE;

BEGIN

  IF norm_name IS NULL OR norm_name = ''
  THEN
    RAISE 'Room name must contain some letters or numbers.'
    USING HINT = 'Room name must contain some letters or numbers.';
  END IF;

  SELECT room_id
  INTO v_id
  FROM rooms
  WHERE room_id = norm_name;

  IF v_id IS NULL
  THEN
    INSERT INTO rooms (room_id, name) VALUES (norm_name, p_param1)
    RETURNING room_id
      INTO v_id;
  END IF;

  RETURN v_id;

END;
$func$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION add_person_to_room(p_room_name rooms.name%TYPE, p_name people.name%TYPE,
                                              p_person_id people.person_id%TYPE, p_socket_id people.socket_id%TYPE)
  RETURNS TABLE(r_room_id TEXT, r_person_id TEXT, r_name TEXT, r_socket_id TEXT) AS $func$
DECLARE
  p_room_id TEXT := get_room(p_room_name);
BEGIN

  INSERT
  INTO people (room_id, person_id, name, socket_id) VALUES (p_room_id, p_person_id, p_name, p_socket_id)
  ON CONFLICT ON CONSTRAINT people_pkey DO UPDATE SET name = p_name, socket_id = p_socket_id;

  RETURN QUERY
  SELECT
    p.room_id,
    p.person_id,
    p.name,
    p.socket_id
  FROM people p
  WHERE p.room_id = p_room_id;

END;
$func$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_poll(
  p_room_name rooms.name%TYPE,
  p_name      polls.name%TYPE,
  p_desc      polls.description%TYPE,
  p_type      polls.type%TYPE,
  p_details   polls.details%TYPE,
  p_owner_id  people.person_id%TYPE)
  RETURNS polls.poll_id%TYPE AS $func$
DECLARE
  p_room_id TEXT := get_room(p_room_name);
  -- Adds room if not present
  ret_id    polls.poll_id%TYPE;
BEGIN

  INSERT INTO polls (room_id, name, description, owner_id, type, details)
  VALUES (p_room_id, p_name, p_desc, p_owner_id, p_type, p_details)
  RETURNING poll_id
    INTO ret_id;

  RETURN ret_id;

END;
$func$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION "json_object_set_key"(
  "json"         JSON,
  "key_to_set"   TEXT,
  "value_to_set" ANYELEMENT
)
  RETURNS JSON
LANGUAGE SQL
IMMUTABLE
STRICT
AS $func$
SELECT concat('{', string_agg(to_json("key") || ':' || "value", ','), '}') :: JSON
FROM (SELECT *
      FROM json_each("json")
      WHERE "key" <> "key_to_set"
      UNION ALL
      SELECT
        "key_to_set",
        to_json("value_to_set")) AS "fields"
$func$;


CREATE OR REPLACE FUNCTION vote(
      p_room_name rooms.name%TYPE,
      p_poll_id   polls.poll_id%TYPE,
      p_person_id people.person_id%TYPE,
      p_vote      JSON,
  OUT person_name people.name%TYPE,
  OUT poll_name   polls.name%TYPE
) AS
$func$
DECLARE
  -- may be redundant, may be useful error-checking.
  p_room_id TEXT := get_room(p_room_name);
BEGIN

  SELECT name
  INTO person_name
  FROM people
  WHERE person_id = p_person_id;

  IF NOT found
  THEN
    RAISE 'Voter not found.'
    USING HINT = 'Voter not found.';
  END IF;

  UPDATE polls
  SET votes = json_object_set_key(votes, p_person_id :: TEXT, json_object_set_key(p_vote, 'name', person_name))
  WHERE poll_id = p_poll_id
  RETURNING name
    INTO poll_name;

  IF NOT found
  THEN
    RAISE 'Poll not found.'
    USING HINT = 'Poll not found.';
  END IF;

END
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION star(p_room_name      stars.room_id%TYPE,
                                p_device_id      stars.device_id%TYPE,
                                p_device_details stars.device_details%TYPE
)
  RETURNS VOID AS $func$
DECLARE
  -- Adds room if not present
  p_room_id TEXT := get_room(p_room_name);
BEGIN

  INSERT INTO stars (room_id, device_id, device_details)
    SELECT
      p_room_id,
      p_device_id,
      p_device_details
    WHERE NOT EXISTS(SELECT 1
                     FROM stars
                     WHERE room_id = p_room_id AND device_id = p_device_id);

END;
$func$ LANGUAGE plpgsql;
