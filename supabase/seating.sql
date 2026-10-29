-- Seating is durable and serialized per room, including swaps and game start.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS seat_index integer;
WITH seats AS (SELECT id, row_number() OVER (PARTITION BY room_id ORDER BY created_at,id)-1 AS seat FROM public.players)
UPDATE public.players p SET seat_index = seats.seat FROM seats WHERE seats.id=p.id AND p.seat_index IS NULL;
ALTER TABLE public.players ALTER COLUMN seat_index SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='players_seat_range') THEN
  ALTER TABLE public.players ADD CONSTRAINT players_seat_range CHECK (seat_index BETWEEN 0 AND 9);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='players_room_seat_unique') THEN
  ALTER TABLE public.players ADD CONSTRAINT players_room_seat_unique UNIQUE(room_id,seat_index) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.uno_join_lobby(p_room_id uuid, p_player jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; s integer; chosen text; suffix integer := 1; result public.players;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF r.id IS NULL OR r.status <> 'lobby' THEN RAISE EXCEPTION 'This room is not accepting players'; END IF;
 SELECT * INTO result FROM public.players WHERE room_id=p_room_id AND session_token=p_player->>'session_token';
 IF result.id IS NOT NULL THEN RETURN to_jsonb(result); END IF;
 SELECT n INTO s FROM generate_series(0,9) n WHERE NOT EXISTS(SELECT 1 FROM public.players WHERE room_id=p_room_id AND seat_index=n) ORDER BY n LIMIT 1;
 IF s IS NULL THEN RAISE EXCEPTION 'Room is full'; END IF;
 chosen := left(p_player->>'name',20);
 WHILE EXISTS(SELECT 1 FROM public.players WHERE room_id=p_room_id AND lower(name)=lower(chosen)) LOOP
  suffix := suffix+1; chosen := left(p_player->>'name',16) || ' ' || suffix;
 END LOOP;
 INSERT INTO public.players(id,room_id,session_token,name,avatar_color,is_host,is_ready,is_online,seat_index)
 VALUES ((p_player->>'id')::uuid,p_room_id,p_player->>'session_token',chosen,p_player->>'avatar_color',false,false,true,s) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.uno_join_lobby(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_join_lobby(uuid,jsonb) TO service_role;

DROP FUNCTION IF EXISTS public.uno_move_seat(uuid,uuid,integer);
CREATE OR REPLACE FUNCTION public.uno_move_seat(p_room_id uuid,p_player_id uuid,p_seat integer,p_expected uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; old_seat integer; other_id uuid;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF r.id IS NULL OR r.status <> 'lobby' THEN RAISE EXCEPTION 'Seats are locked once the game starts'; END IF;
 IF p_seat NOT BETWEEN 0 AND 9 THEN RAISE EXCEPTION 'Invalid seat'; END IF;
 SELECT seat_index INTO old_seat FROM public.players WHERE id=p_player_id AND room_id=p_room_id;
 IF old_seat IS NULL THEN RAISE EXCEPTION 'Player not in room'; END IF;
 SELECT id INTO other_id FROM public.players WHERE room_id=p_room_id AND seat_index=p_seat;
 IF other_id IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'That seat just changed. Please choose again'; END IF;
 UPDATE public.players SET seat_index=CASE WHEN id=p_player_id THEN p_seat ELSE old_seat END
 WHERE room_id=p_room_id AND (id=p_player_id OR id=other_id);
END $$;
REVOKE ALL ON FUNCTION public.uno_move_seat(uuid,uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_move_seat(uuid,uuid,integer,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.uno_start_seated_game(p_room_id uuid,p_host uuid,p_public jsonb,p_secret jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; actual jsonb; proposed jsonb;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF r.status <> 'lobby' OR r.host_player_id <> p_host THEN RAISE EXCEPTION 'Only the host can start a waiting room'; END IF;
 SELECT jsonb_agg(id::text ORDER BY seat_index) INTO actual FROM public.players WHERE room_id=p_room_id;
 SELECT jsonb_agg(value->>'id' ORDER BY ord) INTO proposed FROM jsonb_array_elements(p_public->'players') WITH ORDINALITY AS x(value,ord);
 IF actual IS DISTINCT FROM proposed THEN RAISE EXCEPTION 'Seating changed. Please start again'; END IF;
 IF jsonb_array_length(actual)<2 OR EXISTS(SELECT 1 FROM public.players WHERE room_id=p_room_id AND NOT is_ready) THEN RAISE EXCEPTION 'At least two players must be ready'; END IF;
 INSERT INTO public.game_states(room_id,version,status,public_state,secret_state) VALUES(p_room_id,(p_public->>'version')::integer,'playing',p_public,p_secret);
 UPDATE public.rooms SET status='playing',updated_at=now() WHERE id=p_room_id;
END $$;
REVOKE ALL ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_start_seated_game(uuid,uuid,jsonb,jsonb) TO service_role;
DROP TRIGGER IF EXISTS uno_players_realtime ON public.players;
CREATE TRIGGER uno_players_realtime AFTER INSERT OR UPDATE OF is_ready,is_online,seat_index,name,avatar_color ON public.players
FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();
