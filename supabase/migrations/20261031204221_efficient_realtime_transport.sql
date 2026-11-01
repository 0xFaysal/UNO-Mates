-- Opt-in rollout. Existing tabs keep their atomic per-player snapshots indefinitely.
ALTER TABLE public.players ADD COLUMN realtime_legacy boolean NOT NULL DEFAULT true;
ALTER TABLE public.players ALTER COLUMN realtime_legacy SET DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN realtime_v2_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_states ADD COLUMN hand_versions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE uno_private.realtime_transport(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO uno_private.realtime_transport DEFAULT VALUES;
ALTER TABLE uno_private.realtime_transport ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON uno_private.realtime_transport FROM PUBLIC,anon,authenticated;
GRANT SELECT ON uno_private.realtime_transport TO service_role;

-- A round's roster is immutable. Returning to lobby/restarting retires its topic,
-- so a removed member's cached authorization never exposes a subsequent round.
CREATE OR REPLACE FUNCTION uno_private.can_receive(topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (topic='control:'||auth.uid()::text OR EXISTS(
  SELECT 1 FROM public.players p WHERE p.auth_user_id=auth.uid() AND
   (topic='room:'||p.room_id::text OR topic='player:'||p.id::text OR EXISTS(
    SELECT 1 FROM public.game_states g WHERE g.room_id=p.room_id
     AND topic='table:'||g.room_id::text||':'||(g.public_state->>'roundId')
   ))
 ));
$$;
REVOKE ALL ON FUNCTION uno_private.can_receive(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION uno_private.can_receive(text) TO authenticated;

CREATE FUNCTION uno_private.safe_table_state(state jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_set(jsonb_set(state,'{drawnCardPlayableId}','null'::jsonb),'{discardPile}',
  (SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(state->'discardPile') WITH ORDINALITY a(value,ord)
   WHERE ord>jsonb_array_length(state->'discardPile')-3));
$$;
CREATE FUNCTION uno_private.own_draw_hint(state jsonb,player_id text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN state->'players'->((state->>'turnIndex')::integer)->>'id'=player_id
  THEN coalesce(state->'drawnCardPlayableId','null'::jsonb) ELSE 'null'::jsonb END;
$$;
REVOKE ALL ON FUNCTION uno_private.safe_table_state(jsonb),uno_private.own_draw_hint(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.safe_table_state(jsonb),uno_private.own_draw_hint(jsonb,text) TO service_role;

CREATE FUNCTION uno_private.version_private_hands()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE hand record; versions jsonb:='{}'::jsonb; changed boolean;
BEGIN
 FOR hand IN SELECT key,value FROM jsonb_each(NEW.secret_state->'playerHands') LOOP
  changed:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN changed:=OLD.public_state->>'roundId' IS DISTINCT FROM NEW.public_state->>'roundId'
   OR OLD.hand_versions->hand.key IS NULL OR OLD.secret_state->'playerHands'->hand.key IS DISTINCT FROM hand.value
   OR uno_private.own_draw_hint(OLD.public_state,hand.key) IS DISTINCT FROM uno_private.own_draw_hint(NEW.public_state,hand.key); END IF;
  versions:=versions||jsonb_build_object(hand.key,CASE WHEN changed THEN NEW.version ELSE (OLD.hand_versions->>hand.key)::integer END);
 END LOOP;
 NEW.hand_versions:=versions;RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.version_private_hands() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.version_private_hands() TO service_role;
CREATE TRIGGER uno_transport_hand_versions BEFORE INSERT OR UPDATE OF public_state,secret_state ON public.game_states FOR EACH ROW EXECUTE FUNCTION uno_private.version_private_hands();

CREATE OR REPLACE FUNCTION uno_private.publish_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p record; state jsonb; previous jsonb; safe_state jsonb; rid uuid; optimized boolean:=false; bootstrap boolean:=true;
 versions jsonb; patch jsonb; removed jsonb; envelope jsonb; server_now numeric:=extract(epoch FROM clock_timestamp())*1000;
BEGIN
 IF TG_TABLE_NAME='game_states' THEN
  state:=uno_private.safe_table_state(NEW.public_state);
  SELECT (r.realtime_v2_enabled OR t.enabled) INTO optimized FROM public.rooms r CROSS JOIN uno_private.realtime_transport t WHERE r.id=NEW.room_id;
  optimized:=coalesce(optimized,false) AND NEW.public_state->>'roundId' IS NOT NULL;
  -- For 2/3 split recipients, a shared + private pair costs more/the same.
  -- Keep their existing atomic stream; sharing pays off from four humans onward.
  optimized:=optimized AND (SELECT count(*)>=4 FROM public.players WHERE room_id=NEW.room_id AND NOT is_computer AND NOT realtime_legacy);
  IF TG_OP='UPDATE' THEN bootstrap:=OLD.public_state->>'roundId' IS DISTINCT FROM NEW.public_state->>'roundId'; END IF;
  IF optimized AND NOT bootstrap THEN
   SELECT coalesce(jsonb_object_agg(member.id::text,NEW.hand_versions->member.id::text),'{}'::jsonb) INTO versions
    FROM public.players member WHERE member.room_id=NEW.room_id AND NOT member.is_computer AND NOT member.realtime_legacy;
   IF versions<>'{}'::jsonb THEN
    previous:=uno_private.safe_table_state(OLD.public_state);
    SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO patch FROM jsonb_each(state) a WHERE previous->key IS DISTINCT FROM value;
    SELECT coalesce(jsonb_agg(key),'[]'::jsonb) INTO removed FROM jsonb_object_keys(previous) key WHERE NOT state ? key;
    envelope:=jsonb_build_object('protocol',2,'roomId',NEW.room_id,'roundId',NEW.public_state->>'roundId','version',NEW.version,'handVersions',versions,'serverNow',server_now);
    -- Periodic full checkpoints recover loss; bootstrap/reconnect still use atomic snapshots.
    IF NEW.version%20=0 OR NEW.status<>'playing' OR pg_column_size(patch)>=pg_column_size(state) THEN
     envelope:=envelope||jsonb_build_object('state',state);
    ELSE envelope:=envelope||jsonb_build_object('baseVersion',OLD.version,'patch',patch,'removed',removed); END IF;
    PERFORM realtime.send(envelope,'table_state','table:'||NEW.room_id::text||':'||(NEW.public_state->>'roundId'),true);
   END IF;
  END IF;
  FOR p IN SELECT hand.key,hand.value,member.realtime_legacy FROM jsonb_each(NEW.secret_state->'playerHands') hand
   JOIN public.players member ON member.id::text=hand.key AND member.room_id=NEW.room_id AND NOT member.is_computer LOOP
   IF NOT optimized OR bootstrap OR p.realtime_legacy THEN
    safe_state:=jsonb_set(state,'{drawnCardPlayableId}',uno_private.own_draw_hint(NEW.public_state,p.key));
    PERFORM realtime.send(jsonb_build_object('publicState',safe_state,'myHand',p.value,'myPlayerId',p.key,'serverNow',server_now,'realtimeLegacy',p.realtime_legacy),'state_updated','player:'||p.key,true);
   ELSIF NEW.hand_versions->p.key IS DISTINCT FROM OLD.hand_versions->p.key THEN
    PERFORM realtime.send(jsonb_build_object('protocol',2,'roomId',NEW.room_id,'roundId',NEW.public_state->>'roundId','version',NEW.version,
     'playerId',p.key,'myHand',p.value,'drawnCardPlayableId',uno_private.own_draw_hint(NEW.public_state,p.key),'serverNow',server_now),'private_hand','player:'||p.key,true);
   END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='chat_messages' THEN
  PERFORM realtime.send(jsonb_build_object('id',NEW.id,'playerId',NEW.player_id,'playerName',NEW.player_name,'playerColor',NEW.player_color,'message',NEW.message,'createdAt',extract(epoch FROM NEW.created_at)*1000),'chat_message','room:'||NEW.room_id::text,true);
 ELSE
  IF TG_TABLE_NAME='rooms' THEN rid:=NEW.id;ELSE rid:=NEW.room_id;END IF;
  PERFORM realtime.send('{}'::jsonb,'lobby_update','room:'||rid::text,true);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.publish_changes() FROM PUBLIC,anon,authenticated;

-- One authenticated database read replaces worker authorize + due-row round trips.
CREATE FUNCTION public.uno_clock_work(p_token text,p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(uno_private.clock_authorized(p_token),false) THEN RETURN jsonb_build_object('authorized',false);END IF;
 IF coalesce(array_length(p_ids,1),0)>16 THEN RAISE EXCEPTION 'Invalid batch';END IF;
 RETURN jsonb_build_object('authorized',true,'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('room_id',room_id,'version',version,'public_state',public_state,'secret_state',secret_state)),'[]'::jsonb)
  FROM public.game_states WHERE status='playing' AND room_id=ANY(p_ids)
   AND (clock_due_at<=extract(epoch FROM clock_timestamp())*1000 OR bot_catch_due_at<=extract(epoch FROM clock_timestamp())*1000)));
END;
$$;
REVOKE ALL ON FUNCTION public.uno_clock_work(text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_clock_work(text,uuid[]) TO service_role;
