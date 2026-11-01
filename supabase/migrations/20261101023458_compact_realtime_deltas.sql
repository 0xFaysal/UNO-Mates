-- Compact index-aligned revisions and sparse player fields. Roster order is locked per round.
CREATE OR REPLACE FUNCTION uno_private.publish_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p record; state jsonb; previous jsonb; safe_state jsonb; rid uuid; optimized boolean:=false; bootstrap boolean:=true;
 versions jsonb; patch jsonb; removed jsonb; player_changes jsonb; envelope jsonb; server_now numeric:=extract(epoch FROM clock_timestamp())*1000;
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
   SELECT coalesce(jsonb_agg(CASE WHEN member.id IS NULL OR member.is_computer OR member.realtime_legacy THEN 'null'::jsonb ELSE NEW.hand_versions->member.id::text END ORDER BY person.ord),'[]'::jsonb) INTO versions
    FROM jsonb_array_elements(state->'players') WITH ORDINALITY person(value,ord)
    LEFT JOIN public.players member ON member.id::text=person.value->>'id' AND member.room_id=NEW.room_id;
   IF versions<>'[]'::jsonb THEN
    previous:=uno_private.safe_table_state(OLD.public_state);
    SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO patch FROM jsonb_each(state) a WHERE previous->key IS DISTINCT FROM value;
    SELECT coalesce(jsonb_agg(key),'[]'::jsonb) INTO removed FROM jsonb_object_keys(previous) key WHERE NOT state ? key;
    player_changes:='{}'::jsonb;
    IF (SELECT jsonb_agg(value->'id' ORDER BY ord) FROM jsonb_array_elements(state->'players') WITH ORDINALITY n(value,ord))
      IS NOT DISTINCT FROM (SELECT jsonb_agg(value->'id' ORDER BY ord) FROM jsonb_array_elements(previous->'players') WITH ORDINALITY n(value,ord)) THEN
     SELECT coalesce(jsonb_object_agg((n.ord-1)::text,jsonb_build_object(
      'patch',(SELECT coalesce(jsonb_object_agg(v.key,v.value),'{}'::jsonb) FROM jsonb_each(n.value) v WHERE previous->'players'->((n.ord-1)::integer)->v.key IS DISTINCT FROM v.value),
      'removed',(SELECT coalesce(jsonb_agg(x.key),'[]'::jsonb) FROM jsonb_object_keys(previous->'players'->((n.ord-1)::integer)) x(key) WHERE NOT n.value ? x.key)
     )),'{}'::jsonb) INTO player_changes FROM jsonb_array_elements(state->'players') WITH ORDINALITY n(value,ord)
     WHERE n.value IS DISTINCT FROM previous->'players'->((n.ord-1)::integer);
     patch:=patch-'players';
    END IF;
    envelope:=jsonb_build_object('protocol',2,'roomId',NEW.room_id,'roundId',NEW.public_state->>'roundId','version',NEW.version,'handVersions',versions,'serverNow',server_now);
    -- Periodic full checkpoints recover loss; bootstrap/reconnect still use atomic snapshots.
    IF NEW.version%20=0 OR NEW.status<>'playing' OR pg_column_size(patch)>=pg_column_size(state) THEN
     envelope:=envelope||jsonb_build_object('state',state);
    ELSE envelope:=envelope||jsonb_build_object('baseVersion',OLD.version,'patch',patch,'removed',removed,'playerChanges',player_changes); END IF;
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
