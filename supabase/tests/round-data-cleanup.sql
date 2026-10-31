-- Database-owner regression test. All fixtures and deletions roll back.
BEGIN;
DO $$
DECLARE rid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); before_state jsonb; i integer;
BEGIN
 INSERT INTO public.rooms(id,code,status) VALUES(rid,upper(substr(md5(rid::text),1,6)),'playing'),(other,upper(substr(md5(other::text),1,6)),'lobby');
 INSERT INTO public.players(id,room_id,session_token,name,avatar_color,seat_index) VALUES(pid,rid,gen_random_uuid()::text,'Cleanup fixture','#3b82f6',0);
 INSERT INTO public.game_states(room_id,status,public_state,secret_state)
 VALUES(rid,'playing','{"roundId":"one","players":[],"turnIndex":0,"finishOrder":[],"discardPile":[1,2,3,4,5],"topDiscard":5,"drawPileCount":2}',jsonb_build_object('drawPile',jsonb_build_array(6,7),'playerHands',jsonb_build_object(pid::text,jsonb_build_array(8,9))));
 -- Match the current UI limit, including a same-transaction burst.
 FOR i IN 1..55 LOOP
  INSERT INTO public.chat_messages(room_id,player_id,player_name,player_color,message,created_at)
   VALUES(rid,pid,'Cleanup fixture','#3b82f6','Message '||i,now()+i*interval '1 millisecond');
 END LOOP;
 IF (SELECT count(*) FROM public.chat_messages WHERE room_id=rid)<>50 THEN RAISE EXCEPTION 'History not bounded'; END IF;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=rid AND message='Message 1') THEN RAISE EXCEPTION 'Old chat retained'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=rid AND message='Message 55') THEN RAISE EXCEPTION 'New chat removed'; END IF;
 INSERT INTO public.game_events(room_id,version,event_type) VALUES(rid,1,'fixture');
 INSERT INTO uno_private.reaction_limits(player_id,sent_at) VALUES(pid,now());
 -- A first finisher is not the end of a match: preserve all live cards/chat.
 UPDATE public.game_states SET public_state=jsonb_set(public_state,'{finishOrder}',jsonb_build_array(pid::text)) WHERE room_id=rid;
 IF (SELECT count(*) FROM public.chat_messages WHERE room_id=rid)<>50 OR (SELECT jsonb_array_length(secret_state->'drawPile') FROM public.game_states WHERE room_id=rid)<>2 THEN RAISE EXCEPTION 'Early finisher triggered cleanup'; END IF;
 SELECT public_state INTO before_state FROM public.game_states WHERE room_id=rid;
 UPDATE public.game_states SET status='round_over',public_state=jsonb_set(public_state,'{status}','"round_over"') WHERE room_id=rid;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=rid) OR EXISTS(SELECT 1 FROM public.game_events WHERE room_id=rid) OR EXISTS(SELECT 1 FROM uno_private.reaction_limits WHERE player_id=pid) THEN RAISE EXCEPTION 'Finished auxiliary data retained'; END IF;
 IF (SELECT public_state->'discardPile' FROM public.game_states WHERE room_id=rid)<>'[3,4,5]'::jsonb THEN RAISE EXCEPTION 'Table history corrupted'; END IF;
 IF (SELECT secret_state->'drawPile' FROM public.game_states WHERE room_id=rid)<>'[]'::jsonb THEN RAISE EXCEPTION 'Unused deck retained'; END IF;
 IF (SELECT secret_state->'playerHands'->pid::text FROM public.game_states WHERE room_id=rid)<>'[8,9]'::jsonb THEN RAISE EXCEPTION 'Result hand lost'; END IF;
 IF (SELECT public_state->'finishOrder' FROM public.game_states WHERE room_id=rid) IS DISTINCT FROM before_state->'finishOrder' THEN RAISE EXCEPTION 'Rankings lost'; END IF;
 -- People can still chat on the result screen. A repeated snapshot does not erase it.
 INSERT INTO public.chat_messages(room_id,player_id,player_name,player_color,message) VALUES(rid,pid,'Cleanup fixture','#3b82f6','Good game!');
 UPDATE public.game_states SET public_state=public_state WHERE room_id=rid;
 IF (SELECT count(*) FROM public.chat_messages WHERE room_id=rid)<>1 THEN RAISE EXCEPTION 'Result conversation erased on repeat snapshot'; END IF;
 -- Rematch has a fresh deck and no prior-round chat.
 UPDATE public.game_states SET status='playing',public_state=jsonb_set(public_state,'{roundId}','"two"'),secret_state=jsonb_set(secret_state,'{drawPile}','[10,11]') WHERE room_id=rid;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=rid) OR (SELECT secret_state->'drawPile' FROM public.game_states WHERE room_id=rid)<>'[10,11]'::jsonb THEN RAISE EXCEPTION 'Rematch broken'; END IF;
 -- Closed/offline matches use the same cleanup, and lobby return removes result chat.
 UPDATE public.game_states SET status='game_over' WHERE room_id=rid;
 INSERT INTO public.chat_messages(room_id,player_id,player_name,player_color,message) VALUES(rid,pid,'Cleanup fixture','#3b82f6','Bye');
 DELETE FROM public.game_states WHERE room_id=rid;
 IF EXISTS(SELECT 1 FROM public.chat_messages WHERE room_id=rid) THEN RAISE EXCEPTION 'Lobby return left old chat'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.players WHERE id=pid) OR NOT EXISTS(SELECT 1 FROM public.rooms WHERE id=other) THEN RAISE EXCEPTION 'Membership or other table removed'; END IF;
END;
$$;
ROLLBACK;
SELECT 'Round cleanup, partial finish, 50-message cap, result hand/rankings, repeat updates, rematch and lobby return passed' AS verification;
