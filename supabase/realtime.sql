-- Run once on an existing UNO database. No hand or session data is public.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS auth_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_players_auth_user ON public.players(auth_user_id);
CREATE SCHEMA IF NOT EXISTS uno_private;
REVOKE ALL ON SCHEMA uno_private FROM PUBLIC;
GRANT USAGE ON SCHEMA uno_private TO authenticated;
CREATE OR REPLACE FUNCTION uno_private.can_receive(topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.players p WHERE p.auth_user_id = auth.uid()
  AND (topic = 'room:' || p.room_id::text OR topic = 'player:' || p.id::text)
 );
$$;
REVOKE ALL ON FUNCTION uno_private.can_receive(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION uno_private.can_receive(text) TO authenticated;
DROP POLICY IF EXISTS uno_receive ON realtime.messages;
CREATE POLICY uno_receive ON realtime.messages FOR SELECT TO authenticated
 USING (uno_private.can_receive(realtime.topic()));

CREATE OR REPLACE FUNCTION uno_private.publish_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record; safe_state jsonb; rid uuid;
BEGIN
 IF TG_TABLE_NAME = 'game_states' THEN
  FOR p IN SELECT key, value FROM jsonb_each(NEW.secret_state->'playerHands') LOOP
   safe_state := NEW.public_state;
   IF safe_state->'players'->((safe_state->>'turnIndex')::int)->>'id' <> p.key THEN
    safe_state := jsonb_set(safe_state, '{drawnCardPlayableId}', 'null'::jsonb);
   END IF;
   PERFORM realtime.send(jsonb_build_object('publicState', safe_state, 'myHand', p.value,
    'myPlayerId', p.key), 'state_updated', 'player:' || p.key, true);
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
REVOKE ALL ON FUNCTION uno_private.publish_changes() FROM PUBLIC;
DROP TRIGGER IF EXISTS uno_game_realtime ON public.game_states;
CREATE TRIGGER uno_game_realtime AFTER INSERT OR UPDATE ON public.game_states
 FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();
DROP TRIGGER IF EXISTS uno_chat_realtime ON public.chat_messages;
CREATE TRIGGER uno_chat_realtime AFTER INSERT ON public.chat_messages
 FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();
DROP TRIGGER IF EXISTS uno_players_realtime ON public.players;
CREATE TRIGGER uno_players_realtime AFTER INSERT OR UPDATE OF is_ready, is_online ON public.players
 FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();
DROP TRIGGER IF EXISTS uno_rooms_realtime ON public.rooms;
CREATE TRIGGER uno_rooms_realtime AFTER UPDATE OF status ON public.rooms
 FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();

DROP POLICY IF EXISTS uno_presence ON realtime.messages;
CREATE POLICY uno_presence ON realtime.messages FOR INSERT TO authenticated
 WITH CHECK (extension = 'presence' AND uno_private.can_receive(realtime.topic()));
