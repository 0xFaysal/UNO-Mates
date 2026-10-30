-- Computer seats use the server engine; only people need private realtime snapshots.
CREATE OR REPLACE FUNCTION uno_private.publish_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record; safe_state jsonb; public_base jsonb; rid uuid;
BEGIN
 IF TG_TABLE_NAME = 'game_states' THEN
  public_base := jsonb_set(NEW.public_state, '{discardPile}', (
   SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb)
   FROM jsonb_array_elements(NEW.public_state->'discardPile') WITH ORDINALITY x(value,ord)
   WHERE ord > jsonb_array_length(NEW.public_state->'discardPile')-3
  ));
  FOR p IN SELECT hand.key,hand.value FROM jsonb_each(NEW.secret_state->'playerHands') hand JOIN public.players member ON member.id::text=hand.key AND member.room_id=NEW.room_id AND NOT member.is_computer LOOP
   safe_state := public_base;
   IF safe_state->'players'->((safe_state->>'turnIndex')::int)->>'id' <> p.key THEN
    safe_state := jsonb_set(safe_state, '{drawnCardPlayableId}', 'null'::jsonb);
   END IF;
   PERFORM realtime.send(jsonb_build_object('publicState', safe_state, 'myHand', p.value,
    'myPlayerId', p.key, 'serverNow', extract(epoch from clock_timestamp()) * 1000), 'state_updated', 'player:' || p.key, true);
  END LOOP;
 ELSIF TG_TABLE_NAME = 'chat_messages' THEN
  PERFORM realtime.send(jsonb_build_object('id', NEW.id, 'playerId', NEW.player_id,
   'playerName', NEW.player_name, 'playerColor', NEW.player_color, 'message', NEW.message,
   'createdAt', extract(epoch from NEW.created_at) * 1000),
   'chat_message', 'room:' || NEW.room_id::text, true);
 ELSE
  IF TG_TABLE_NAME = 'rooms' THEN rid := NEW.id; ELSE rid := NEW.room_id; END IF;
  PERFORM realtime.send('{}'::jsonb, 'lobby_update', 'room:' || rid::text, true);
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION uno_private.publish_member_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE member record; message jsonb;
BEGIN
  message := jsonb_build_object('id', NEW.id, 'playerId', NEW.player_id,
    'playerName', NEW.player_name, 'playerColor', NEW.player_color,
    'message', NEW.message, 'createdAt', extract(epoch from NEW.created_at) * 1000);
  FOR member IN SELECT id FROM public.players WHERE room_id = NEW.room_id AND NOT is_computer LOOP
    PERFORM realtime.send(message, 'chat_message', 'player:' || member.id::text, true);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.publish_member_chat() FROM PUBLIC,anon,authenticated;
