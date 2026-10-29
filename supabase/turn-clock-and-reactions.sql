-- Twenty-second turns are resolved by a server worker, not browser polling.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS uno_private;
REVOKE ALL ON SCHEMA uno_private FROM PUBLIC;
GRANT USAGE ON SCHEMA uno_private TO service_role;

ALTER TABLE public.game_states ADD COLUMN IF NOT EXISTS clock_due_at bigint
 GENERATED ALWAYS AS ((coalesce(public_state->>'automationAt',public_state->>'turnDeadlineAt'))::bigint) STORED;
ALTER TABLE public.game_states ADD COLUMN IF NOT EXISTS clock_dispatch_until timestamptz;
CREATE INDEX IF NOT EXISTS uno_clock_due ON public.game_states(clock_due_at)
 WHERE status='playing' AND clock_due_at IS NOT NULL;
-- Claim bookkeeping is not a game move and must not generate state broadcasts.
DROP TRIGGER IF EXISTS uno_game_realtime ON public.game_states;
CREATE TRIGGER uno_game_realtime AFTER INSERT OR UPDATE OF public_state,secret_state ON public.game_states
 FOR EACH ROW EXECUTE FUNCTION uno_private.publish_changes();

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='uno_clock_token') THEN
  PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'uno_clock_token');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='uno_clock_url') THEN
  PERFORM vault.create_secret('https://dvdidsrzwdcvlereqddx.supabase.co/functions/v1/uno-clock','uno_clock_url');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION uno_private.clock_authorized(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT length(p_token)=64 AND EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='uno_clock_token' AND decrypted_secret=p_token);
$$;
REVOKE ALL ON FUNCTION uno_private.clock_authorized(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.clock_authorized(text) TO service_role;
CREATE OR REPLACE FUNCTION public.uno_clock_authorized(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT uno_private.clock_authorized(p_token);
$$;
REVOKE ALL ON FUNCTION public.uno_clock_authorized(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_clock_authorized(text) TO service_role;

CREATE OR REPLACE FUNCTION uno_private.dispatch_clock()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids jsonb; endpoint text; token text;
BEGIN
 WITH due AS (
  SELECT room_id FROM public.game_states
  WHERE status='playing' AND clock_due_at<=extract(epoch FROM clock_timestamp())*1000
   AND (clock_dispatch_until IS NULL OR clock_dispatch_until<clock_timestamp())
  ORDER BY clock_due_at LIMIT 16 FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE public.game_states g SET clock_dispatch_until=clock_timestamp()+interval '6 seconds'
  FROM due WHERE g.room_id=due.room_id RETURNING g.room_id
 ) SELECT jsonb_agg(room_id) INTO ids FROM claimed;
 IF ids IS NULL THEN RETURN; END IF;
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='uno_clock_url';
 SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='uno_clock_token';
 PERFORM net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-uno-clock',token),body:=jsonb_build_object('roomIds',ids),timeout_milliseconds:=5000);
END;
$$;
REVOKE ALL ON FUNCTION uno_private.dispatch_clock() FROM PUBLIC,anon,authenticated;
-- The worker is deployed before this migration is applied. No HTTP invocation when no turn is due.
SELECT cron.schedule('uno-turn-clock','1 second','SELECT uno_private.dispatch_clock()');
-- Avoid retaining one cron log row per second indefinitely.
SELECT cron.schedule('uno-clock-log-cleanup','17 * * * *',$$DELETE FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='uno-turn-clock') AND end_time<now()-interval '2 hours'$$);

CREATE TABLE IF NOT EXISTS uno_private.reaction_limits (
 player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
 sent_at timestamptz NOT NULL
);
ALTER TABLE uno_private.reaction_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON uno_private.reaction_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON uno_private.reaction_limits TO service_role;

CREATE OR REPLACE FUNCTION public.uno_table_reaction(p_code text,p_session text,p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE rid uuid; actor public.players; last_at timestamptz; event jsonb; member record;
BEGIN
 IF p_key NOT IN ('nice','laugh','oops','wow') THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
 SELECT id INTO rid FROM public.rooms WHERE code=upper(trim(p_code)) FOR UPDATE;
 SELECT * INTO actor FROM public.players WHERE room_id=rid AND session_token=p_session FOR UPDATE;
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Player not in room'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.game_states WHERE room_id=rid AND status='playing') THEN RAISE EXCEPTION 'The round is not active'; END IF;
 SELECT sent_at INTO last_at FROM uno_private.reaction_limits WHERE player_id=actor.id;
 IF last_at>clock_timestamp()-interval '2 seconds' THEN RAISE EXCEPTION 'Wait a moment before another reaction'; END IF;
 INSERT INTO uno_private.reaction_limits VALUES(actor.id,clock_timestamp())
 ON CONFLICT(player_id) DO UPDATE SET sent_at=excluded.sent_at;
 event:=jsonb_build_object('id',gen_random_uuid(),'playerId',actor.id,'playerName',actor.name,'key',p_key,'createdAt',extract(epoch FROM clock_timestamp())*1000);
 FOR member IN SELECT id FROM public.players WHERE room_id=rid LOOP
  PERFORM realtime.send(event,'table_reaction','player:'||member.id::text,true);
 END LOOP;
 RETURN event;
END;
$$;
REVOKE ALL ON FUNCTION public.uno_table_reaction(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_table_reaction(text,text,text) TO service_role;
