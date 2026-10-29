-- Server-only lobby management. Shares the room lock used by joining, seating and start.
CREATE OR REPLACE FUNCTION uno_private.can_receive(topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  topic = 'control:' || auth.uid()::text OR EXISTS (
   SELECT 1 FROM public.players p WHERE p.auth_user_id = auth.uid()
   AND (topic = 'room:' || p.room_id::text OR topic = 'player:' || p.id::text)
  )
 );
$$;
REVOKE ALL ON FUNCTION uno_private.can_receive(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION uno_private.can_receive(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.uno_rename_lobby_player(p_code text, p_session text, p_name text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.rooms; actor public.players; chosen text;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO actor FROM public.players WHERE room_id = r.id AND session_token = p_session;
  IF actor.id IS NULL THEN RAISE EXCEPTION 'You are no longer in this room' USING ERRCODE = '42501'; END IF;
  IF r.status <> 'lobby' THEN RAISE EXCEPTION 'Names are locked once the game starts'; END IF;
  chosen := regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g');
  IF chosen IS NULL OR char_length(chosen) NOT BETWEEN 1 AND 20 OR chosen ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Use a name with 1 to 20 characters' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE room_id = r.id AND id <> actor.id AND lower(name) = lower(chosen)) THEN
    RAISE EXCEPTION 'That name is already taken in this room';
  END IF;
  UPDATE public.players SET name = chosen WHERE id = actor.id;
  RETURN chosen;
END;
$$;
REVOKE ALL ON FUNCTION public.uno_rename_lobby_player(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_rename_lobby_player(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.uno_remove_lobby_player(p_code text, p_session text, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.rooms; actor public.players; target public.players;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE code = upper(btrim(p_code)) FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO actor FROM public.players WHERE room_id = r.id AND session_token = p_session;
  IF actor.id IS NULL OR r.host_player_id <> actor.id THEN
    RAISE EXCEPTION 'Only the host can remove players' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'lobby' THEN RAISE EXCEPTION 'Players cannot be removed after the game starts'; END IF;
  IF p_target = actor.id THEN RAISE EXCEPTION 'The host cannot remove themselves' USING ERRCODE = '22023'; END IF;
  SELECT * INTO target FROM public.players WHERE id = p_target AND room_id = r.id;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That player has already left this lobby'; END IF;
  DELETE FROM public.players WHERE id = target.id AND room_id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.uno_remove_lobby_player(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_remove_lobby_player(text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION uno_private.publish_lobby_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.rooms WHERE id = OLD.room_id AND status = 'lobby') THEN
    PERFORM realtime.send(jsonb_build_object('playerId', OLD.id), 'lobby_member_removed', 'room:' || OLD.room_id::text, true);
    IF OLD.auth_user_id IS NOT NULL THEN
      PERFORM realtime.send(jsonb_build_object('playerId', OLD.id), 'lobby_member_removed', 'control:' || OLD.auth_user_id::text, true);
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.publish_lobby_removal() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS uno_player_removed_realtime ON public.players;
CREATE TRIGGER uno_player_removed_realtime AFTER DELETE ON public.players
FOR EACH ROW EXECUTE FUNCTION uno_private.publish_lobby_removal();

CREATE OR REPLACE FUNCTION public.uno_start_seated_game(p_room_id uuid,p_host uuid,p_public jsonb,p_secret jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; actual jsonb; proposed jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF r.id IS NULL OR r.status <> 'lobby' OR r.host_player_id IS DISTINCT FROM p_host THEN RAISE EXCEPTION 'Only the host can start a waiting room'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id::text,'name',name,'avatarColor',avatar_color) ORDER BY seat_index) INTO actual FROM public.players WHERE room_id=p_room_id;
 SELECT jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name','avatarColor',value->>'avatarColor') ORDER BY ord) INTO proposed FROM jsonb_array_elements(p_public->'players') WITH ORDINALITY AS x(value,ord);
 IF actual IS DISTINCT FROM proposed THEN RAISE EXCEPTION 'The lobby changed. Please start again'; END IF;
 IF jsonb_array_length(actual)<2 OR EXISTS(SELECT 1 FROM public.players WHERE room_id=p_room_id AND NOT is_ready) THEN RAISE EXCEPTION 'At least two players must be ready'; END IF;
 INSERT INTO public.game_states(room_id,version,status,public_state,secret_state) VALUES(p_room_id,(p_public->>'version')::integer,'playing',p_public,p_secret);
 UPDATE public.rooms SET status='playing',updated_at=now() WHERE id=p_room_id;
END $$;
REVOKE ALL ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) TO service_role;

-- Name changes use the existing private lobby broadcast path.
DROP TRIGGER IF EXISTS uno_players_realtime ON public.players;
CREATE TRIGGER uno_players_realtime AFTER INSERT OR UPDATE OF is_ready,is_online,seat_index,name,avatar_color ON public.players
FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();

-- Existing private-channel permissions can be cached until reconnect.
-- Address chat to the current roster's player topics so old room subscriptions
-- cannot continue receiving messages after their membership is removed.
CREATE OR REPLACE FUNCTION uno_private.publish_member_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE member record; message jsonb;
BEGIN
  message := jsonb_build_object('id', NEW.id, 'playerId', NEW.player_id,
    'playerName', NEW.player_name, 'playerColor', NEW.player_color,
    'message', NEW.message, 'createdAt', extract(epoch from NEW.created_at) * 1000);
  FOR member IN SELECT id FROM public.players WHERE room_id = NEW.room_id LOOP
    PERFORM realtime.send(message, 'chat_message', 'player:' || member.id::text, true);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.publish_member_chat() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS uno_chat_realtime ON public.chat_messages;
CREATE TRIGGER uno_chat_realtime AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION uno_private.publish_member_chat();
