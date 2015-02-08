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

-- Actually: "people currently in a room".
CREATE TABLE people (
  room_id   TEXT REFERENCES rooms ON UPDATE CASCADE ON DELETE CASCADE,
  uuid      TEXT                     NOT NULL,
  created   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name      TEXT                     NOT NULL,
  socket_id TEXT                     NOT NULL,
  PRIMARY KEY (room_id, uuid)
);

CREATE TABLE polls (
  poll_id SERIAL PRIMARY KEY,
  room_id TEXT REFERENCES rooms ON UPDATE CASCADE ON DELETE CASCADE,
  created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name    TEXT                     NOT NULL,
  type    TEXT                     NOT NULL,
  details JSON                     NOT NULL,
  votes   JSON                     NOT NULL DEFAULT '{}'
);

-- CREATE TABLE votes (
--   vote_id SERIAL PRIMARY KEY,
--   poll_id INTEGER                  NOT NULL REFERENCES polls ON UPDATE CASCADE ON DELETE CASCADE,
--   created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   person  TEXT                     NOT NULL,
--   vote    JSON                     NOT NULL
-- );

CREATE OR REPLACE FUNCTION vt_normalize(TEXT)
  RETURNS TEXT AS
  $$
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
  $$
LANGUAGE SQL
IMMUTABLE
RETURNS NULL ON NULL INPUT;

CREATE OR REPLACE FUNCTION get_room(p_param1 rooms.name%TYPE)
  RETURNS rooms.room_id%TYPE AS $$
DECLARE
  norm_name TEXT := vt_normalize(p_param1);
  v_id      rooms.room_id%TYPE;

BEGIN

  IF norm_name IS NULL OR norm_name = ''
  THEN
    RAISE 'Room name must contain some letters or numbers.';
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
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION add_person_to_room(p_room_name rooms.name%TYPE, p_name people.name%TYPE,
                                              p_uuid      people.uuid%TYPE, p_socket_id people.socket_id%TYPE)
  RETURNS TABLE(r_uuid TEXT, r_name TEXT, r_socket_id TEXT) AS $$
DECLARE
  p_room_id TEXT := get_room(p_room_name);
BEGIN

  UPDATE people
  SET name = p_name, socket_id = p_socket_id
  WHERE uuid = p_uuid AND room_id = p_room_id;

  IF NOT FOUND
  THEN
    INSERT INTO people (room_id, uuid, name, socket_id) VALUES (p_room_id, p_uuid, p_name, p_socket_id);
  END IF;

  RETURN QUERY
  SELECT
    p.uuid,
    p.name,
    p.socket_id
  FROM people p
  WHERE p.room_id = p_room_id;

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_poll(p_room_name rooms.name%TYPE, p_name polls.name%TYPE,
                                       p_type      polls.type%TYPE, p_details polls.details%TYPE)
  RETURNS polls.poll_id%TYPE AS $$
DECLARE
  p_room_id TEXT := get_room(p_room_name);
  ret_id    polls.poll_id%TYPE;
BEGIN

  INSERT INTO polls (room_id, name, type, details)
  VALUES (p_room_id, p_name, p_type, p_details)
  RETURNING poll_id
    INTO ret_id;

  RETURN ret_id;

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION "json_object_set_key"(
  "json"         JSON,
  "key_to_set"   TEXT,
  "value_to_set" ANYELEMENT
)
  RETURNS JSON
LANGUAGE SQL
IMMUTABLE
STRICT
AS $function$
SELECT concat('{', string_agg(to_json("key") || ':' || "value", ','), '}') :: JSON
FROM (SELECT *
      FROM json_each("json")
      WHERE "key" <> "key_to_set"
      UNION ALL
      SELECT
        "key_to_set",
        to_json("value_to_set")) AS "fields"
$function$;


CREATE OR REPLACE FUNCTION vote(p_room_name   rooms.name%TYPE, p_poll_id polls.poll_id%TYPE,
                                p_person_uuid people.uuid%TYPE, p_vote JSON)
  RETURNS people.name%TYPE AS $$
DECLARE
  p_room_id TEXT := get_room(p_room_name);
  ret_name  people.name%TYPE;
BEGIN

  SELECT name
  INTO ret_name
  FROM people
  WHERE uuid = p_person_uuid;

  IF NOT found
  THEN
    RAISE 'Voter not found.';
  END IF;

  UPDATE polls
  SET votes = json_object_set_key(votes, p_person_uuid, p_vote)
  WHERE poll_id = p_poll_id;

  --TODO: check if update affected one row, otherwise "Poll not found."

  RETURN ret_name;

END;
$$ LANGUAGE plpgsql;