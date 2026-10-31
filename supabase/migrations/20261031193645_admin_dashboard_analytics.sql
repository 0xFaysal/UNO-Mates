-- Private owner account. Credentials are provisioned separately, never in source control.
CREATE TABLE uno_private.admin_account (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), username text UNIQUE NOT NULL,
 password_hash text NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE uno_private.admin_sessions (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE uno_private.admin_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE uno_private.analytics_meta (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), tracking_since timestamptz NOT NULL DEFAULT now()
);
INSERT INTO uno_private.analytics_meta DEFAULT VALUES;
-- Anonymous daily totals survive raw-room cleanup; no names, messages, IPs or hands.
CREATE TABLE uno_private.analytics_daily (
 day date PRIMARY KEY, started bigint NOT NULL DEFAULT 0, completed bigint NOT NULL DEFAULT 0,
 abandoned bigint NOT NULL DEFAULT 0, human_seats bigint NOT NULL DEFAULT 0, bot_seats bigint NOT NULL DEFAULT 0,
 duration_seconds bigint NOT NULL DEFAULT 0, duration_count bigint NOT NULL DEFAULT 0,
 plays bigint NOT NULL DEFAULT 0, draws bigint NOT NULL DEFAULT 0, timeouts bigint NOT NULL DEFAULT 0
);
ALTER TABLE uno_private.admin_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.admin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.analytics_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.analytics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON uno_private.admin_account,uno_private.admin_sessions,uno_private.admin_attempts,uno_private.analytics_meta,uno_private.analytics_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON uno_private.admin_account,uno_private.admin_sessions,uno_private.admin_attempts,uno_private.analytics_meta,uno_private.analytics_daily TO service_role;

CREATE FUNCTION public.uno_admin_identity(p_token_hash text)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT a.username FROM uno_private.admin_account a
 WHERE EXISTS(SELECT 1 FROM uno_private.admin_sessions WHERE token_hash=p_token_hash AND expires_at>now());
$$;

CREATE FUNCTION public.uno_admin_sign_in(p_username text,p_password text,p_ip_hash text,p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uno_private.admin_account; allowed boolean;
BEGIN
 IF length(p_username)>100 OR octet_length(p_password)>72 OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false); END IF;
 PERFORM pg_advisory_xact_lock(714018,2);
 DELETE FROM uno_private.admin_sessions WHERE expires_at<now();
 DELETE FROM uno_private.admin_attempts WHERE window_start<now()-interval '1 day';
 INSERT INTO uno_private.admin_attempts(key) VALUES(p_ip_hash),('global') ON CONFLICT DO NOTHING;
 UPDATE uno_private.admin_attempts SET attempts=0,window_start=now() WHERE key IN (p_ip_hash,'global') AND window_start<now()-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM uno_private.admin_attempts WHERE (key=p_ip_hash AND attempts>=8) OR (key='global' AND attempts>=60)) THEN RETURN jsonb_build_object('ok',false,'limited',true); END IF;
 UPDATE uno_private.admin_attempts SET attempts=attempts+1 WHERE key IN (p_ip_hash,'global');
 SELECT * INTO a FROM uno_private.admin_account FOR UPDATE;
 IF a.username IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
 allowed:=extensions.crypt(p_password,a.password_hash)=a.password_hash;
 IF NOT allowed OR a.username<>p_username THEN RETURN jsonb_build_object('ok',false); END IF;
 DELETE FROM uno_private.admin_attempts WHERE key=p_ip_hash;
 INSERT INTO uno_private.admin_sessions(token_hash,expires_at) VALUES(p_token_hash,now()+interval '8 hours');
 RETURN jsonb_build_object('ok',true,'username',a.username);
END;
$$;

CREATE FUNCTION public.uno_admin_sign_out(p_token_hash text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 DELETE FROM uno_private.admin_sessions WHERE token_hash=p_token_hash;
$$;

CREATE FUNCTION public.uno_admin_change_password(p_token_hash text,p_current text,p_new text,p_replacement_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a uno_private.admin_account; attempt_key text:='change:'||p_token_hash;
BEGIN
 IF length(p_new)<12 OR octet_length(p_new)>72 OR octet_length(p_current)>72 OR p_replacement_hash !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('ok',false); END IF;
 SELECT * INTO a FROM uno_private.admin_account FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM uno_private.admin_sessions WHERE token_hash=p_token_hash AND expires_at>now()) THEN RETURN jsonb_build_object('ok',false,'expired',true); END IF;
 INSERT INTO uno_private.admin_attempts(key) VALUES(attempt_key) ON CONFLICT DO NOTHING;
 UPDATE uno_private.admin_attempts SET attempts=0,window_start=now() WHERE key=attempt_key AND window_start<now()-interval '15 minutes';
 IF EXISTS(SELECT 1 FROM uno_private.admin_attempts WHERE key=attempt_key AND attempts>=8) THEN RETURN jsonb_build_object('ok',false,'limited',true); END IF;
 UPDATE uno_private.admin_attempts SET attempts=attempts+1 WHERE key=attempt_key;
 IF extensions.crypt(p_current,a.password_hash)<>a.password_hash THEN RETURN jsonb_build_object('ok',false); END IF;
 IF extensions.crypt(p_new,a.password_hash)=a.password_hash THEN RETURN jsonb_build_object('ok',false,'same',true); END IF;
 UPDATE uno_private.admin_account SET password_hash=extensions.crypt(p_new,extensions.gen_salt('bf',12)),changed_at=now();
 DELETE FROM uno_private.admin_sessions;
 DELETE FROM uno_private.admin_attempts WHERE key=attempt_key;
 INSERT INTO uno_private.admin_sessions(token_hash,expires_at) VALUES(p_replacement_hash,now()+interval '8 hours');
 RETURN jsonb_build_object('ok',true);
END;
$$;

-- Backfill only rounds still present. Missing/deleted historical rounds are not invented.
INSERT INTO uno_private.analytics_daily(day,started,completed,abandoned,human_seats,bot_seats)
SELECT (CASE WHEN (public_state->>'roundStartedAt') ~ '^[0-9]{13}$'
 THEN to_timestamp((public_state->>'roundStartedAt')::numeric/1000) ELSE updated_at END AT TIME ZONE 'Asia/Dhaka')::date,
 count(*),0,0,
 coalesce(sum((SELECT count(*) FROM jsonb_array_elements(public_state->'players') p WHERE NOT coalesce((p->>'isComputer')::boolean,false))),0),
 coalesce(sum((SELECT count(*) FROM jsonb_array_elements(public_state->'players') p WHERE coalesce((p->>'isComputer')::boolean,false))),0)
FROM public.game_states GROUP BY 1;
INSERT INTO uno_private.analytics_daily(day,completed,abandoned)
SELECT (CASE WHEN (public_state->>'updatedAt') ~ '^[0-9]{13}$'
 THEN to_timestamp((public_state->>'updatedAt')::numeric/1000) ELSE updated_at END AT TIME ZONE 'Asia/Dhaka')::date,
 count(*) FILTER(WHERE status='round_over'),count(*) FILTER(WHERE status='game_over')
FROM public.game_states WHERE status IN ('round_over','game_over') GROUP BY 1
ON CONFLICT(day) DO UPDATE SET completed=EXCLUDED.completed,abandoned=EXCLUDED.abandoned;

CREATE FUNCTION uno_private.count_game_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d date:=(statement_timestamp() AT TIME ZONE 'Asia/Dhaka')::date;
 starts integer:=0; finishes integer:=0; closes integer:=0; humans integer:=0; bots integer:=0;
 elapsed bigint:=0; timed integer:=0; played integer:=0; drawn integer:=0; missed integer:=0; new_move boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN starts:=1;
 ELSE
  IF NEW.public_state->>'roundId' IS DISTINCT FROM OLD.public_state->>'roundId' THEN starts:=1; END IF;
  new_move:=NEW.public_state->'lastMove'->>'id' IS DISTINCT FROM OLD.public_state->'lastMove'->>'id';
 END IF;
 IF starts=1 THEN
  SELECT count(*) FILTER(WHERE NOT coalesce((p->>'isComputer')::boolean,false)),count(*) FILTER(WHERE coalesce((p->>'isComputer')::boolean,false)) INTO humans,bots FROM jsonb_array_elements(NEW.public_state->'players') p;
 END IF;
 IF NEW.status IN ('round_over','game_over') AND (TG_OP='INSERT' OR OLD.status='playing') THEN
  finishes:=(NEW.status='round_over')::integer; closes:=(NEW.status='game_over')::integer;
  IF NEW.public_state->>'roundStartedAt' ~ '^[0-9]{13}$' THEN
   elapsed:=floor(extract(epoch FROM statement_timestamp())-(NEW.public_state->>'roundStartedAt')::numeric/1000);
   IF elapsed BETWEEN 0 AND 86400 THEN timed:=1; ELSE elapsed:=0; END IF;
  END IF;
 END IF;
 IF new_move AND starts=0 THEN
  played:=(NEW.public_state->'lastMove'->>'type'='play')::integer;
  drawn:=(NEW.public_state->'lastMove'->>'type'='draw')::integer;
  missed:=(NEW.public_state->'lastMove'->>'type'='timeout')::integer;
 END IF;
 IF starts+finishes+closes+coalesce(played,0)+coalesce(drawn,0)+coalesce(missed,0)=0 THEN RETURN NULL; END IF;
 INSERT INTO uno_private.analytics_daily(day,started,completed,abandoned,human_seats,bot_seats,duration_seconds,duration_count,plays,draws,timeouts)
 VALUES(d,starts,finishes,closes,humans,bots,elapsed,timed,coalesce(played,0),coalesce(drawn,0),coalesce(missed,0))
 ON CONFLICT(day) DO UPDATE SET started=analytics_daily.started+EXCLUDED.started,completed=analytics_daily.completed+EXCLUDED.completed,
 abandoned=analytics_daily.abandoned+EXCLUDED.abandoned,human_seats=analytics_daily.human_seats+EXCLUDED.human_seats,bot_seats=analytics_daily.bot_seats+EXCLUDED.bot_seats,
 duration_seconds=analytics_daily.duration_seconds+EXCLUDED.duration_seconds,duration_count=analytics_daily.duration_count+EXCLUDED.duration_count,
 plays=analytics_daily.plays+EXCLUDED.plays,draws=analytics_daily.draws+EXCLUDED.draws,timeouts=analytics_daily.timeouts+EXCLUDED.timeouts;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.count_game_activity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.count_game_activity() TO service_role;
CREATE TRIGGER uno_stats_activity AFTER INSERT OR UPDATE OF status,public_state ON public.game_states FOR EACH ROW EXECUTE FUNCTION uno_private.count_game_activity();

CREATE FUNCTION uno_private.admin_cleanup_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('active',j.active,'schedule',j.schedule,'lastStatus',r.status,'lastRun',r.end_time)
 FROM cron.job j LEFT JOIN LATERAL(SELECT status,end_time FROM cron.job_run_details WHERE jobid=j.jobid ORDER BY runid DESC LIMIT 1) r ON true WHERE j.jobname='uno-data-cleanup';
$$;
REVOKE ALL ON FUNCTION uno_private.admin_cleanup_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.admin_cleanup_status() TO service_role;

CREATE FUNCTION uno_private.admin_recent_sign_in(p_room uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT max(u.last_sign_in_at) FROM public.players p JOIN auth.users u ON u.id=p.auth_user_id WHERE p.room_id=p_room;
$$;
REVOKE ALL ON FUNCTION uno_private.admin_recent_sign_in(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.admin_recent_sign_in(uuid) TO service_role;

CREATE FUNCTION public.uno_admin_dashboard(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE today date:=(now() AT TIME ZONE 'Asia/Dhaka')::date; result jsonb;
BEGIN
 IF p_days NOT IN (7,30) THEN RAISE EXCEPTION 'Invalid range'; END IF;
 SELECT jsonb_build_object(
  'trackingSince',(SELECT tracking_since FROM uno_private.analytics_meta),
  'totals',(SELECT jsonb_build_object('started',coalesce(sum(started),0),'completed',coalesce(sum(completed),0),'abandoned',coalesce(sum(abandoned),0),
   'humanSeats',coalesce(sum(human_seats),0),'botSeats',coalesce(sum(bot_seats),0),'durationSeconds',coalesce(sum(duration_seconds),0),'durationCount',coalesce(sum(duration_count),0),
   'plays',coalesce(sum(plays),0),'draws',coalesce(sum(draws),0),'timeouts',coalesce(sum(timeouts),0)) FROM uno_private.analytics_daily),
  'series',(SELECT jsonb_agg(jsonb_build_object('day',s.day::date,'started',coalesce(a.started,0),'completed',coalesce(a.completed,0),'abandoned',coalesce(a.abandoned,0)) ORDER BY s.day)
   FROM generate_series((today-p_days+1)::timestamp,today::timestamp,interval '1 day') s(day) LEFT JOIN uno_private.analytics_daily a ON a.day=s.day::date),
  'today',(SELECT jsonb_build_object('started',coalesce(started,0),'completed',coalesce(completed,0),'abandoned',coalesce(abandoned,0)) FROM (SELECT 1) seed LEFT JOIN uno_private.analytics_daily a ON a.day=today),
  'storage',(SELECT jsonb_build_object('rooms',count(*),'waiting',count(*) FILTER(WHERE status='lobby')) FROM public.rooms),
  'cleanup',uno_private.admin_cleanup_status(),
  'candidates',(SELECT coalesce(jsonb_agg(c),'[]'::jsonb) FROM (
   SELECT r.id,r.code,r.status,g.public_state->>'roundStartedAt' AS started,
    (SELECT count(*) FROM public.players p WHERE p.room_id=r.id AND p.is_computer) AS bots,
    (SELECT coalesce(jsonb_agg(p.id),'[]'::jsonb) FROM public.players p WHERE p.room_id=r.id AND NOT p.is_computer) AS humans
   FROM public.rooms r LEFT JOIN public.game_states g ON g.room_id=r.id
   WHERE (g.status='playing' AND g.updated_at>now()-interval '2 minutes') OR
    (r.status='lobby' AND greatest(r.updated_at,uno_private.admin_recent_sign_in(r.id))>now()-interval '70 minutes')
   ORDER BY coalesce(g.updated_at,r.updated_at) DESC LIMIT 41
  ) c)
 ) INTO result;
 RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.uno_admin_identity(text),public.uno_admin_sign_in(text,text,text,text),public.uno_admin_sign_out(text),public.uno_admin_change_password(text,text,text,text),public.uno_admin_dashboard(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_admin_identity(text),public.uno_admin_sign_in(text,text,text,text),public.uno_admin_sign_out(text),public.uno_admin_change_password(text,text,text,text),public.uno_admin_dashboard(integer) TO service_role;
