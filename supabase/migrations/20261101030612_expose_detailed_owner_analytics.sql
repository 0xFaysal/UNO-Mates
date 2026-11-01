CREATE FUNCTION uno_private.detailed_dashboard(p_days integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('since',(SELECT detailed_since FROM uno_private.analytics_meta),'days',p_days,
  'setups',(SELECT coalesce(jsonb_agg(r ORDER BY r.humans,r.bots),'[]'::jsonb) FROM (
   SELECT humans,bots,sum(started) started,sum(completed) completed,sum(abandoned) abandoned,sum(plays) plays,sum(draws) draws,sum(timeouts) timeouts,
    sum(duration_seconds) "durationSeconds",sum(sample_count) "sampleCount",sum(completed_plays) "completedPlays"
   FROM uno_private.analytics_setup_daily WHERE day BETWEEN (now() AT TIME ZONE 'Asia/Dhaka')::date-p_days+1 AND (now() AT TIME ZONE 'Asia/Dhaka')::date GROUP BY humans,bots
  ) r),
  'visitors',jsonb_build_object('today',(SELECT jsonb_build_object('newPlayers',coalesce(new_players,0),'returningPlayers',coalesce(returning_players,0)) FROM (SELECT 1) seed LEFT JOIN uno_private.analytics_audience_daily a ON a.day=(now() AT TIME ZONE 'Asia/Dhaka')::date),
   'series',(SELECT jsonb_agg(jsonb_build_object('day',s.day::date,'newPlayers',coalesce(a.new_players,0),'returningPlayers',coalesce(a.returning_players,0)) ORDER BY s.day)
    FROM generate_series(((now() AT TIME ZONE 'Asia/Dhaka')::date-p_days+1)::timestamp,((now() AT TIME ZONE 'Asia/Dhaka')::date)::timestamp,interval '1 day') s(day) LEFT JOIN uno_private.analytics_audience_daily a ON a.day=s.day::date)));
$$;
REVOKE ALL ON FUNCTION uno_private.detailed_dashboard(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.detailed_dashboard(integer) TO service_role;
ALTER FUNCTION public.uno_admin_dashboard(integer) RENAME TO uno_admin_dashboard_base;
CREATE FUNCTION public.uno_admin_dashboard(p_days integer DEFAULT 7) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT public.uno_admin_dashboard_base(p_days)||jsonb_build_object('detailed',uno_private.detailed_dashboard(p_days));
$$;
REVOKE ALL ON FUNCTION public.uno_admin_dashboard(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_admin_dashboard(integer) TO service_role;

-- Daily aggregates survive cleanup. Identity links do not grow without expiry.
CREATE FUNCTION uno_private.prune_audience() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 DELETE FROM uno_private.analytics_visitor_days WHERE day<(now() AT TIME ZONE 'Asia/Dhaka')::date-31;
 DELETE FROM uno_private.analytics_visitors WHERE last_day<(now() AT TIME ZONE 'Asia/Dhaka')::date-365;
$$;
REVOKE ALL ON FUNCTION uno_private.prune_audience() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.prune_audience() TO service_role;
SELECT cron.schedule('uno-audience-cleanup','51 * * * *','SELECT uno_private.prune_audience()');
