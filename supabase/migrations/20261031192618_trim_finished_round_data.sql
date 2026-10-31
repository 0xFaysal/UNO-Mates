-- Only a fully completed/closed round is compacted, never a single finisher.
CREATE OR REPLACE FUNCTION uno_private.compact_finished_round()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.status IN ('round_over','game_over') THEN
  NEW.secret_state:=jsonb_set(NEW.secret_state,'{drawPile}','[]'::jsonb);
  NEW.public_state:=jsonb_set(NEW.public_state,'{discardPile}',
   (SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb)
    FROM jsonb_array_elements(NEW.public_state->'discardPile') WITH ORDINALITY a(value,ord)
    WHERE ord>jsonb_array_length(NEW.public_state->'discardPile')-3));
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.compact_finished_round() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.compact_finished_round() TO service_role;
CREATE TRIGGER uno_compact_finished_round BEFORE INSERT OR UPDATE OF status,public_state,secret_state ON public.game_states
 FOR EACH ROW EXECUTE FUNCTION uno_private.compact_finished_round();

CREATE OR REPLACE FUNCTION uno_private.clear_round_ephemera()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rid uuid; clear_data boolean:=false;
BEGIN
 IF TG_OP='DELETE' THEN
  rid:=OLD.room_id; clear_data:=OLD.status IN ('round_over','game_over');
 ELSIF TG_OP='INSERT' THEN
  rid:=NEW.room_id; clear_data:=NEW.status IN ('round_over','game_over');
 ELSE
  rid:=NEW.room_id;
  clear_data:=(OLD.status IS DISTINCT FROM NEW.status OR OLD.public_state->>'roundId' IS DISTINCT FROM NEW.public_state->>'roundId')
   AND (OLD.status IN ('round_over','game_over') OR NEW.status IN ('round_over','game_over'));
 END IF;
 IF clear_data THEN
  DELETE FROM public.chat_messages WHERE room_id=rid;
  DELETE FROM public.game_events WHERE room_id=rid;
  DELETE FROM uno_private.reaction_limits WHERE player_id IN (SELECT id FROM public.players WHERE room_id=rid);
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.clear_round_ephemera() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.clear_round_ephemera() TO service_role;
CREATE TRIGGER uno_clear_round_ephemera AFTER INSERT OR UPDATE OF status,public_state OR DELETE ON public.game_states
 FOR EACH ROW EXECUTE FUNCTION uno_private.clear_round_ephemera();

-- Match the client's existing 50-message history limit in persistent storage.
-- Serialize concurrent sends within one room; this does not introduce network polling.
CREATE OR REPLACE FUNCTION uno_private.lock_chat_retention()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('uno-chat:'||NEW.room_id::text,0));
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION uno_private.trim_chat_history()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 DELETE FROM public.chat_messages WHERE id IN (
  SELECT id FROM public.chat_messages WHERE room_id=NEW.room_id ORDER BY created_at DESC,id DESC OFFSET 50
 );
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.lock_chat_retention(),uno_private.trim_chat_history() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.lock_chat_retention(),uno_private.trim_chat_history() TO service_role;
CREATE TRIGGER uno_chat_retention_lock BEFORE INSERT ON public.chat_messages
 FOR EACH ROW EXECUTE FUNCTION uno_private.lock_chat_retention();
CREATE TRIGGER uno_chat_retention_trim AFTER INSERT ON public.chat_messages
 FOR EACH ROW EXECUTE FUNCTION uno_private.trim_chat_history();

-- Apply the same policy to already finished rounds; preserve every playing state.
DELETE FROM public.chat_messages c USING public.game_states g
 WHERE c.room_id=g.room_id AND g.status IN ('round_over','game_over');
DELETE FROM public.game_events e USING public.game_states g
 WHERE e.room_id=g.room_id AND g.status IN ('round_over','game_over');
DELETE FROM uno_private.reaction_limits l USING public.players p,public.game_states g
 WHERE l.player_id=p.id AND p.room_id=g.room_id AND g.status IN ('round_over','game_over');
UPDATE public.game_states SET public_state=public_state,secret_state=secret_state
 WHERE status IN ('round_over','game_over') AND
  (jsonb_array_length(public_state->'discardPile')>3 OR jsonb_array_length(secret_state->'drawPile')>0);
DELETE FROM public.chat_messages WHERE id IN (
 SELECT id FROM (SELECT id,row_number() OVER(PARTITION BY room_id ORDER BY created_at DESC,id DESC) AS position FROM public.chat_messages) ranked WHERE position>50
);
