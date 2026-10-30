-- Persistent computer seats are distinct from temporary offline takeovers.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_computer boolean NOT NULL DEFAULT false;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='computer_players_are_guests' AND conrelid='public.players'::regclass) THEN ALTER TABLE public.players ADD CONSTRAINT computer_players_are_guests CHECK (NOT is_computer OR NOT is_host); END IF; END $$;
ALTER TABLE public.game_states ADD COLUMN IF NOT EXISTS bot_catch_due_at bigint
 GENERATED ALWAYS AS ((public_state->>'botCatchAt')::bigint) STORED;
CREATE INDEX IF NOT EXISTS uno_bot_catch_due ON public.game_states(bot_catch_due_at)
 WHERE status='playing' AND bot_catch_due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.uno_add_computer_player(p_code text,p_session text,p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; actor public.players; seat integer; chosen text; suffix integer:=1; result public.players; colors text[]:=ARRAY['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899','#06b6d4','#f97316','#ef4444']; color_index integer;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
 SELECT * INTO actor FROM public.players WHERE room_id=r.id AND session_token=p_session AND NOT is_computer;
 IF actor.id IS NULL OR actor.id IS DISTINCT FROM r.host_player_id THEN RAISE EXCEPTION 'Only the host can add bots' USING ERRCODE='42501'; END IF;
 IF r.status<>'lobby' THEN RAISE EXCEPTION 'Bots can only join before the game starts'; END IF;
 SELECT n INTO seat FROM generate_series(0,9) n WHERE NOT EXISTS(SELECT 1 FROM public.players WHERE room_id=r.id AND seat_index=n) ORDER BY n LIMIT 1;
 IF seat IS NULL THEN RAISE EXCEPTION 'The table is full'; END IF;
 chosen:=left(coalesce(nullif(trim(p_name),''),'Mango Bot'),20);
 WHILE EXISTS(SELECT 1 FROM public.players WHERE room_id=r.id AND lower(name)=lower(chosen)) LOOP
  suffix:=suffix+1;chosen:=left(p_name,16)||' '||suffix;
 END LOOP;
 SELECT count(*)%8+1 INTO color_index FROM public.players WHERE room_id=r.id AND is_computer;
 INSERT INTO public.players(room_id,session_token,name,avatar_color,is_host,is_ready,is_online,seat_index,is_computer)
 VALUES(r.id,encode(extensions.gen_random_bytes(32),'hex'),chosen,colors[color_index],false,true,false,seat,true) RETURNING * INTO result;
 RETURN to_jsonb(result);
END;
$$;
REVOKE ALL ON FUNCTION public.uno_add_computer_player(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_add_computer_player(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.uno_start_seated_game(p_room_id uuid,p_host uuid,p_public jsonb,p_secret jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; actual jsonb; proposed jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF r.id IS NULL OR r.status <> 'lobby' OR r.host_player_id IS DISTINCT FROM p_host THEN RAISE EXCEPTION 'Only the host can start a waiting room'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id::text,'name',name,'avatarColor',avatar_color,'isComputer',is_computer) ORDER BY seat_index) INTO actual FROM public.players WHERE room_id=p_room_id;
 SELECT jsonb_agg(jsonb_build_object('id',value->>'id','name',value->>'name','avatarColor',value->>'avatarColor','isComputer',coalesce((value->>'isComputer')::boolean,false)) ORDER BY ord) INTO proposed FROM jsonb_array_elements(p_public->'players') WITH ORDINALITY AS x(value,ord);
 IF actual IS DISTINCT FROM proposed THEN RAISE EXCEPTION 'The lobby changed. Please start again'; END IF;
 IF jsonb_array_length(actual)<2 OR EXISTS(SELECT 1 FROM public.players WHERE room_id=p_room_id AND NOT is_ready) THEN RAISE EXCEPTION 'At least two players must be ready'; END IF;
 INSERT INTO public.game_states(room_id,version,status,public_state,secret_state) VALUES(p_room_id,(p_public->>'version')::integer,'playing',p_public,p_secret);
 UPDATE public.rooms SET status='playing',updated_at=now() WHERE id=p_room_id;
END $$;
REVOKE ALL ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) TO service_role;

-- Bot readiness is an invariant, including existing return-to-lobby operations.
CREATE OR REPLACE FUNCTION uno_private.keep_computer_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.is_computer THEN NEW.is_ready:=true;NEW.is_online:=false;END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.keep_computer_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.keep_computer_ready() TO service_role;
DROP TRIGGER IF EXISTS uno_computer_readiness ON public.players;
CREATE TRIGGER uno_computer_readiness BEFORE INSERT OR UPDATE OF is_ready,is_online ON public.players FOR EACH ROW EXECUTE FUNCTION uno_private.keep_computer_ready();

CREATE OR REPLACE FUNCTION uno_private.dispatch_clock()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids jsonb; endpoint text; token text;
BEGIN
 WITH due AS (
  SELECT room_id FROM public.game_states
  WHERE status='playing' AND (clock_due_at<=extract(epoch FROM clock_timestamp())*1000 OR bot_catch_due_at<=extract(epoch FROM clock_timestamp())*1000)
   AND (clock_dispatch_until IS NULL OR clock_dispatch_until<clock_timestamp())
  ORDER BY least(clock_due_at,bot_catch_due_at) LIMIT 16 FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE public.game_states g SET clock_dispatch_until=clock_timestamp()+interval '20 seconds'
  FROM due WHERE g.room_id=due.room_id RETURNING g.room_id
 ) SELECT jsonb_agg(room_id) INTO ids FROM claimed;
 IF ids IS NULL THEN RETURN; END IF;
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='uno_clock_url';
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='uno_clock_token';
 PERFORM net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-uno-clock',token),body:=jsonb_build_object('roomIds',ids),timeout_milliseconds:=20000);
END;
$$;
REVOKE ALL ON FUNCTION uno_private.dispatch_clock() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.uno_game_context(p_code text,p_session text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('roomId',r.id,'roomStatus',r.status,'playerId',p.id,'isHost',p.is_host,
  'state',CASE WHEN g.room_id IS NULL THEN NULL ELSE jsonb_build_object(
   'gameState',g.public_state,'drawPile',g.secret_state->'drawPile','playerHands',g.secret_state->'playerHands') END)
 FROM public.rooms r JOIN public.players p ON p.room_id=r.id AND p.session_token=p_session
 LEFT JOIN public.game_states g ON g.room_id=r.id WHERE r.code=upper(trim(p_code)) AND NOT p.is_computer;
$$;
REVOKE ALL ON FUNCTION public.uno_game_context(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_game_context(text,text) TO service_role;
