-- Owner-only regression suite: all credentials, sessions, stats and fixtures roll back.
BEGIN;
INSERT INTO uno_private.admin_account(username,password_hash)
 VALUES('regression-owner',extensions.crypt('OnlyForTesting123!',extensions.gen_salt('bf',4)))
 ON CONFLICT(singleton) DO UPDATE SET username=EXCLUDED.username,password_hash=EXCLUDED.password_hash;
SET LOCAL ROLE service_role;
DO $$
DECLARE response jsonb; i integer;
BEGIN
 IF has_function_privilege('anon','public.uno_admin_dashboard(integer)','EXECUTE')
  OR has_function_privilege('authenticated','public.uno_admin_sign_in(text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Admin RPC exposed'; END IF;
 FOR i IN 1..8 LOOP
  response:=public.uno_admin_sign_in('regression-owner','wrong',repeat('a',64),repeat('b',64));
  IF (response->>'ok')::boolean THEN RAISE EXCEPTION 'Wrong password accepted'; END IF;
 END LOOP;
 response:=public.uno_admin_sign_in('regression-owner','OnlyForTesting123!',repeat('a',64),repeat('b',64));
 IF response->>'limited'<>'true' THEN RAISE EXCEPTION 'Brute-force guard failed'; END IF;
 response:=public.uno_admin_sign_in('regression-owner','OnlyForTesting123!',repeat('c',64),repeat('d',64));
 IF response->>'ok'<>'true' OR public.uno_admin_identity(repeat('d',64))<>'regression-owner' THEN RAISE EXCEPTION 'Valid login failed'; END IF;
 PERFORM public.uno_admin_sign_in('regression-owner','OnlyForTesting123!',repeat('c',64),repeat('e',64));
 response:=public.uno_admin_change_password(repeat('d',64),'wrong','ReplacementTest123!',repeat('f',64));
 IF response->>'ok'<>'false' THEN RAISE EXCEPTION 'Current password not required'; END IF;
 response:=public.uno_admin_change_password(repeat('d',64),'OnlyForTesting123!','ReplacementTest123!',repeat('f',64));
 IF response->>'ok'<>'true' OR public.uno_admin_identity(repeat('f',64))<>'regression-owner' THEN RAISE EXCEPTION 'Password change failed'; END IF;
 IF public.uno_admin_identity(repeat('d',64)) IS NOT NULL OR public.uno_admin_identity(repeat('e',64)) IS NOT NULL THEN RAISE EXCEPTION 'Old sessions not revoked'; END IF;
 PERFORM public.uno_admin_sign_out(repeat('f',64));
 IF public.uno_admin_identity(repeat('f',64)) IS NOT NULL THEN RAISE EXCEPTION 'Logout did not revoke session'; END IF;
 IF jsonb_array_length(public.uno_admin_dashboard(30)->'series')<>30 THEN RAISE EXCEPTION 'Date range incorrect'; END IF;
END;
$$;
DO $$
DECLARE rid uuid:=gen_random_uuid(); initial jsonb:=public.uno_admin_dashboard(7)->'totals'; result jsonb;
BEGIN
 INSERT INTO public.rooms(id,code,status) VALUES(rid,upper(substr(md5(rid::text),1,6)),'playing');
 INSERT INTO public.game_states(room_id,status,public_state,secret_state)
 VALUES(rid,'playing',jsonb_build_object('roundId','fixture-one','roundStartedAt',floor(extract(epoch FROM now()-interval '1 minute')*1000),'discardPile','[]'::jsonb,'players','[{"isComputer":false},{"isComputer":false},{"isComputer":true}]'::jsonb),'{"drawPile":[],"playerHands":{}}');
 UPDATE public.game_states SET public_state=jsonb_set(public_state,'{lastMove}','{"id":"fixture-play","type":"play"}') WHERE room_id=rid;
 UPDATE public.game_states SET public_state=public_state WHERE room_id=rid;
 UPDATE public.game_states SET status='round_over' WHERE room_id=rid;
 UPDATE public.game_states SET public_state=public_state WHERE room_id=rid;
 UPDATE public.game_states SET status='playing',public_state=jsonb_set(public_state,'{roundId}','"fixture-two"') WHERE room_id=rid;
 UPDATE public.game_states SET status='game_over' WHERE room_id=rid;
 DELETE FROM public.rooms WHERE id=rid;
 result:=public.uno_admin_dashboard(7)->'totals';
 IF (result->>'started')::bigint-(initial->>'started')::bigint<>2
  OR (result->>'completed')::bigint-(initial->>'completed')::bigint<>1
  OR (result->>'abandoned')::bigint-(initial->>'abandoned')::bigint<>1
  OR (result->>'plays')::bigint-(initial->>'plays')::bigint<>1
  OR (result->>'humanSeats')::bigint-(initial->>'humanSeats')::bigint<>4
  OR (result->>'botSeats')::bigint-(initial->>'botSeats')::bigint<>2
 THEN RAISE EXCEPTION 'Analytics count, deduplication, rematch or deletion durability failed'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'Admin auth, rate limits, password change, revocation, protected RPCs, analytics deduplication and cleanup durability passed' AS verification;
