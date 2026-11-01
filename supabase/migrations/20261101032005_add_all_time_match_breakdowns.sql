CREATE OR REPLACE FUNCTION public.uno_admin_dashboard(p_days integer DEFAULT 7) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT public.uno_admin_dashboard_base(p_days)||jsonb_build_object('detailed',uno_private.detailed_dashboard(p_days)||jsonb_build_object(
  'trackingIssues',(SELECT count(*) FROM public.game_states WHERE analytics_state->>'incomplete'='true'),
  'allTimeSetups',(SELECT coalesce(jsonb_agg(r ORDER BY r.humans,r.bots),'[]'::jsonb) FROM (
   SELECT humans,bots,sum(started) started,sum(completed) completed,sum(abandoned) abandoned,sum(plays) plays,sum(draws) draws,sum(timeouts) timeouts,
    sum(duration_seconds) "durationSeconds",sum(sample_count) "sampleCount",sum(completed_plays) "completedPlays"
   FROM uno_private.analytics_setup_daily GROUP BY humans,bots
  ) r)));
$$;
