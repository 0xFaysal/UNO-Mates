-- Bounded per-round counters and anonymous browser cohorts. No names, IPs or hands.
ALTER TABLE public.players ADD COLUMN visitor_hash text CHECK(visitor_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE public.game_states ADD COLUMN analytics_state jsonb;
ALTER TABLE uno_private.analytics_meta ADD COLUMN detailed_since timestamptz NOT NULL DEFAULT now();
CREATE TABLE uno_private.analytics_setup_daily(
 day date NOT NULL,humans smallint NOT NULL,bots smallint NOT NULL,
 started bigint NOT NULL DEFAULT 0,completed bigint NOT NULL DEFAULT 0,abandoned bigint NOT NULL DEFAULT 0,
 plays bigint NOT NULL DEFAULT 0,draws bigint NOT NULL DEFAULT 0,timeouts bigint NOT NULL DEFAULT 0,
 duration_seconds bigint NOT NULL DEFAULT 0,sample_count bigint NOT NULL DEFAULT 0,completed_plays bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(day,humans,bots),CHECK(humans BETWEEN 1 AND 10 AND bots BETWEEN 0 AND 9 AND humans+bots BETWEEN 2 AND 10)
);
CREATE TABLE uno_private.analytics_visitors(
 visitor_hash text PRIMARY KEY CHECK(visitor_hash ~ '^[a-f0-9]{64}$'),first_day date NOT NULL,last_day date NOT NULL
);
CREATE INDEX analytics_visitors_expiry ON uno_private.analytics_visitors(last_day);
CREATE TABLE uno_private.analytics_visitor_days(
 day date NOT NULL,visitor_hash text NOT NULL CHECK(visitor_hash ~ '^[a-f0-9]{64}$'),PRIMARY KEY(day,visitor_hash)
);
CREATE TABLE uno_private.analytics_audience_daily(day date PRIMARY KEY,new_players bigint NOT NULL DEFAULT 0,returning_players bigint NOT NULL DEFAULT 0);
ALTER TABLE uno_private.analytics_setup_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.analytics_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.analytics_visitor_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_private.analytics_audience_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON uno_private.analytics_setup_daily,uno_private.analytics_visitors,uno_private.analytics_visitor_days,uno_private.analytics_audience_daily FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON uno_private.analytics_setup_daily,uno_private.analytics_visitors,uno_private.analytics_visitor_days,uno_private.analytics_audience_daily TO service_role;

CREATE FUNCTION uno_private.assign_visitor_hash() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT NEW.is_computer AND NEW.visitor_hash IS NULL THEN
  NEW.visitor_hash:=encode(extensions.digest('uno-audience:'||NEW.session_token,'sha256'),'hex');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION uno_private.assign_visitor_hash() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.assign_visitor_hash() TO service_role;
CREATE TRIGGER uno_analytics_visitor BEFORE INSERT ON public.players FOR EACH ROW EXECUTE FUNCTION uno_private.assign_visitor_hash();

-- Seed only retained rounds. Erased history and historic move counts cannot be reconstructed.
WITH retained AS (
 SELECT g.*,(CASE WHEN public_state->>'roundStartedAt' ~ '^[0-9]{13}$' THEN to_timestamp((public_state->>'roundStartedAt')::numeric/1000) ELSE updated_at END AT TIME ZONE 'Asia/Dhaka')::date started_day,
 (CASE WHEN public_state->>'updatedAt' ~ '^[0-9]{13}$' THEN to_timestamp((public_state->>'updatedAt')::numeric/1000) ELSE updated_at END AT TIME ZONE 'Asia/Dhaka')::date ended_day,
 (SELECT count(*) FROM jsonb_array_elements(public_state->'players') p WHERE NOT coalesce((p->>'isComputer')::boolean,false)) humans,
 (SELECT count(*) FROM jsonb_array_elements(public_state->'players') p WHERE coalesce((p->>'isComputer')::boolean,false)) bots FROM public.game_states g
), events AS (
 SELECT started_day AS day,humans,bots,1 started,0 completed,0 abandoned FROM retained
 UNION ALL SELECT ended_day,humans,bots,0,(status='round_over')::integer,(status='game_over')::integer FROM retained WHERE status IN ('round_over','game_over')
)
INSERT INTO uno_private.analytics_setup_daily(day,humans,bots,started,completed,abandoned)
 SELECT day,humans,bots,sum(started),sum(completed),sum(abandoned) FROM events WHERE humans BETWEEN 1 AND 10 AND bots BETWEEN 0 AND 9 AND humans+bots BETWEEN 2 AND 10 GROUP BY day,humans,bots;
INSERT INTO uno_private.analytics_visitors(visitor_hash,first_day,last_day)
 SELECT coalesce(p.visitor_hash,encode(extensions.digest('uno-audience:'||p.session_token,'sha256'),'hex')),min((to_timestamp((g.public_state->>'roundStartedAt')::numeric/1000) AT TIME ZONE 'Asia/Dhaka')::date),max((to_timestamp((g.public_state->>'roundStartedAt')::numeric/1000) AT TIME ZONE 'Asia/Dhaka')::date)
 FROM public.game_states g CROSS JOIN LATERAL jsonb_array_elements(g.public_state->'players') person
 JOIN public.players p ON p.id::text=person->>'id' AND p.room_id=g.room_id
 WHERE NOT p.is_computer AND g.public_state->>'roundStartedAt' ~ '^[0-9]{13}$' GROUP BY 1;
UPDATE public.game_states SET analytics_state=jsonb_build_object('roundId',public_state->>'roundId','plays',0,'full',false,'seen','{}'::jsonb);
