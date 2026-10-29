-- One indexed, server-only read replaces three network round trips per move.
CREATE OR REPLACE FUNCTION public.uno_game_context(p_code text,p_session text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('roomId',r.id,'roomStatus',r.status,'playerId',p.id,'isHost',p.is_host,
  'state',CASE WHEN g.room_id IS NULL THEN NULL ELSE jsonb_build_object(
   'gameState',g.public_state,'drawPile',g.secret_state->'drawPile','playerHands',g.secret_state->'playerHands') END)
 FROM public.rooms r JOIN public.players p ON p.room_id=r.id AND p.session_token=p_session
 LEFT JOIN public.game_states g ON g.room_id=r.id WHERE r.code=upper(trim(p_code));
$$;
REVOKE ALL ON FUNCTION public.uno_game_context(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_game_context(text,text) TO service_role;

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
  FOR p IN SELECT key, value FROM jsonb_each(NEW.secret_state->'playerHands') LOOP
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
