-- Run as postgres after the retention migration. All fixtures AND cleanup roll back.
BEGIN;
DO $$
DECLARE
 ids uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 fixture_guests uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 member uuid:=gen_random_uuid(); i integer; result jsonb;
BEGIN
 FOR i IN 1..9 LOOP
  INSERT INTO public.rooms(id,code,status,created_at,updated_at)
   VALUES(ids[i],upper(substr(md5(ids[i]::text),1,6)),CASE WHEN i IN (3,4,8,9) THEN 'lobby' WHEN i IN (5,6) THEN 'playing' ELSE 'finished' END,
    now()-interval '8 days',now()-interval '8 days');
 END LOOP;
 UPDATE public.rooms SET updated_at=now()-interval '12 hours' WHERE id=ids[2];
 UPDATE public.rooms SET updated_at=now()-interval '6 days' WHERE id=ids[4];
 FOR i IN 1..7 LOOP
  IF i IN (3,4) THEN CONTINUE; END IF;
  INSERT INTO public.game_states(room_id,status,public_state,secret_state,updated_at)
   VALUES(ids[i],CASE WHEN i=5 THEN 'playing' WHEN i=6 THEN 'round_over' ELSE 'game_over' END,
    '{"discardPile":[],"players":[],"turnIndex":0}', '{"playerHands":{},"drawPile":[]}',now()-interval '8 days');
 END LOOP;
 FOR i IN 1..5 LOOP
  INSERT INTO auth.users(id,email,created_at,updated_at,last_sign_in_at)
   VALUES(fixture_guests[i],CASE WHEN i=4 THEN fixture_guests[i]::text||'@retention-test.invalid' WHEN i=5 THEN 'not-a-player-'||fixture_guests[i]::text||'@guest.uno.invalid' ELSE fixture_guests[i]::text||'@guest.uno.invalid' END,
    now()-interval '8 days',now()-interval '8 days',CASE WHEN i=3 THEN now() ELSE now()-interval '8 days' END);
 END LOOP;
 -- Linked identity survives even when old; recent member activity protects old lobbies.
 INSERT INTO public.players(id,room_id,session_token,name,avatar_color,auth_user_id,seat_index,created_at,last_seen_at)
  VALUES(fixture_guests[2],ids[8],gen_random_uuid()::text,'Retention linked','#3b82f6',fixture_guests[2],0,now()-interval '8 days',now());
 INSERT INTO public.players(id,room_id,session_token,name,avatar_color,auth_user_id,seat_index,created_at,last_seen_at)
  VALUES(fixture_guests[3],ids[9],gen_random_uuid()::text,'Retention auth','#3b82f6',fixture_guests[3],0,now()-interval '8 days',now()-interval '8 days');
 INSERT INTO public.players(id,room_id,session_token,name,avatar_color,seat_index,created_at,last_seen_at)
  VALUES(member,ids[1],gen_random_uuid()::text,'Retention cascade','#3b82f6',0,now()-interval '8 days',now()-interval '8 days');
 INSERT INTO public.chat_messages(room_id,player_id,player_name,player_color,message,created_at)
  VALUES(ids[1],member,'Retention cascade','#3b82f6','Old fixture',now()-interval '8 days');
 INSERT INTO public.game_events(room_id,version,event_type) VALUES(ids[1],1,'retention_fixture');
 INSERT INTO uno_private.reaction_limits(player_id,sent_at) VALUES(member,now()-interval '8 days');
 -- Chat alone protects a completed room without relying on room.updated_at.
 INSERT INTO public.players(room_id,session_token,name,avatar_color,seat_index,created_at,last_seen_at)
  VALUES(ids[7],gen_random_uuid()::text,'Retention chat','#3b82f6',0,now()-interval '8 days',now()-interval '8 days');
 INSERT INTO public.chat_messages(room_id,player_id,player_name,player_color,message)
  SELECT ids[7],id,name,avatar_color,'Recent fixture' FROM public.players WHERE room_id=ids[7];
 IF has_function_privilege('anon','uno_private.cleanup_expired_data()','EXECUTE')
  OR has_function_privilege('authenticated','uno_private.cleanup_expired_data()','EXECUTE')
  OR has_function_privilege('service_role','uno_private.cleanup_expired_data()','EXECUTE') THEN RAISE EXCEPTION 'Cleanup exposed'; END IF;
 result:=uno_private.cleanup_expired_data();
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=ANY(ARRAY[ids[1],ids[3],ids[6]])) THEN RAISE EXCEPTION 'Expired room survived'; END IF;
 IF (SELECT count(*) FROM public.rooms WHERE id=ANY(ARRAY[ids[2],ids[4],ids[5],ids[7],ids[8],ids[9]]))<>6 THEN RAISE EXCEPTION 'Protected room deleted'; END IF;
 IF EXISTS(SELECT 1 FROM public.players WHERE id=member)
  OR EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=ids[1])
  OR EXISTS(SELECT 1 FROM public.game_states WHERE room_id=ids[1])
  OR EXISTS(SELECT 1 FROM public.game_events WHERE room_id=ids[1])
  OR EXISTS(SELECT 1 FROM uno_private.reaction_limits WHERE player_id=member) THEN RAISE EXCEPTION 'Cascade incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=fixture_guests[1]) THEN RAISE EXCEPTION 'Old orphan survived'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE id=ANY(fixture_guests[2:5]))<>4 THEN RAISE EXCEPTION 'Protected identity deleted'; END IF;
 -- Idempotent on these fixtures, even when the job is manually repeated.
 PERFORM uno_private.cleanup_expired_data();
 IF (SELECT count(*) FROM public.rooms WHERE id=ANY(ids))<>6 THEN RAISE EXCEPTION 'Repeat cleanup changed survivors'; END IF;
 -- All writers are timestamped; scheduler lease bookkeeping does not extend retention.
 UPDATE public.game_states SET public_state=public_state WHERE room_id=ids[5];
 IF (SELECT updated_at FROM public.game_states WHERE room_id=ids[5])<now()-interval '1 minute' THEN RAISE EXCEPTION 'Game activity not timestamped'; END IF;
 UPDATE public.game_states SET updated_at=now()-interval '2 days' WHERE room_id=ids[5];
 UPDATE public.game_states SET clock_dispatch_until=now() WHERE room_id=ids[5];
 IF (SELECT updated_at FROM public.game_states WHERE room_id=ids[5])>now()-interval '1 day' THEN RAISE EXCEPTION 'Lease bookkeeping prolonged retention'; END IF;
END;
$$;
SELECT 'retention: expiration, active-game/reconnect guards, cascades, guest scope, permissions and repeat invocation passed' AS verification;
ROLLBACK;
