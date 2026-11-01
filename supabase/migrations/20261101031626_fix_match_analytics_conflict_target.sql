CREATE OR REPLACE FUNCTION uno_private.track_match_details() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE d date:=(statement_timestamp() AT TIME ZONE 'Asia/Dhaka')::date;
 starts integer:=0; finishes integer:=0; closes integer:=0; humans integer; bots integer;
 played integer:=0;drawn integer:=0;missed integer:=0;new_move boolean:=false;elapsed bigint:=0;sample integer:=0;complete_plays bigint:=0;
 member record; actor text; seen jsonb; full_round boolean;
BEGIN
 IF TG_OP='INSERT' THEN starts:=1;
 ELSE
  starts:=(NEW.public_state->>'roundId' IS DISTINCT FROM OLD.public_state->>'roundId')::integer;
  new_move:=NEW.public_state->'lastMove'->>'id' IS DISTINCT FROM OLD.public_state->'lastMove'->>'id';
 END IF;
 IF starts=1 THEN NEW.analytics_state:=jsonb_build_object('roundId',NEW.public_state->>'roundId','plays',0,'full',true,'seen','{}'::jsonb);
 ELSE NEW.analytics_state:=coalesce(OLD.analytics_state,jsonb_build_object('plays',0,'full',false,'seen','{}'::jsonb)); END IF;
 IF new_move AND starts=0 THEN
  played:=coalesce((NEW.public_state->'lastMove'->>'type'='play')::integer,0);
  drawn:=coalesce((NEW.public_state->'lastMove'->>'type'='draw')::integer,0);
  missed:=coalesce((NEW.public_state->'lastMove'->>'type'='timeout')::integer,0);
  NEW.analytics_state:=jsonb_set(NEW.analytics_state,'{plays}',to_jsonb((NEW.analytics_state->>'plays')::bigint+played));
 END IF;
 IF NEW.status IN ('round_over','game_over') AND (TG_OP='INSERT' OR OLD.status='playing') THEN
  finishes:=(NEW.status='round_over')::integer;closes:=(NEW.status='game_over')::integer;
  full_round:=coalesce((NEW.analytics_state->>'full')::boolean,false);
  IF finishes=1 AND full_round AND NEW.public_state->>'roundStartedAt' ~ '^[0-9]{13}$' THEN
   elapsed:=floor(extract(epoch FROM statement_timestamp())-(NEW.public_state->>'roundStartedAt')::numeric/1000);
   IF elapsed>=0 THEN sample:=1;complete_plays:=(NEW.analytics_state->>'plays')::bigint; ELSE elapsed:=0; END IF;
  END IF;
 END IF;
 IF starts+finishes+closes+played+drawn+missed>0 THEN
  SELECT count(*) FILTER(WHERE NOT coalesce((p->>'isComputer')::boolean,false)),count(*) FILTER(WHERE coalesce((p->>'isComputer')::boolean,false)) INTO humans,bots FROM jsonb_array_elements(NEW.public_state->'players') p;
  IF humans BETWEEN 1 AND 10 AND bots BETWEEN 0 AND 9 AND humans+bots BETWEEN 2 AND 10 THEN
   INSERT INTO uno_private.analytics_setup_daily(day,humans,bots,started,completed,abandoned,plays,draws,timeouts,duration_seconds,sample_count,completed_plays)
   VALUES(d,humans,bots,starts,finishes,closes,played,drawn,missed,elapsed,sample,complete_plays)
   ON CONFLICT ON CONSTRAINT analytics_setup_daily_pkey DO UPDATE SET started=analytics_setup_daily.started+EXCLUDED.started,completed=analytics_setup_daily.completed+EXCLUDED.completed,abandoned=analytics_setup_daily.abandoned+EXCLUDED.abandoned,
    plays=analytics_setup_daily.plays+EXCLUDED.plays,draws=analytics_setup_daily.draws+EXCLUDED.draws,timeouts=analytics_setup_daily.timeouts+EXCLUDED.timeouts,
    duration_seconds=analytics_setup_daily.duration_seconds+EXCLUDED.duration_seconds,sample_count=analytics_setup_daily.sample_count+EXCLUDED.sample_count,completed_plays=analytics_setup_daily.completed_plays+EXCLUDED.completed_plays;
  END IF;
 END IF;
 seen:=coalesce(NEW.analytics_state->'seen','{}'::jsonb);actor:=NEW.public_state->'lastMove'->>'playerId';
 -- Starts count participants once. Across midnight, actual human moves count that actor.
 IF starts=1 OR (new_move AND NEW.public_state->'lastMove'->>'type' IN ('play','draw','color','other')) THEN
  FOR member IN SELECT p.id::text id,coalesce(p.visitor_hash,encode(extensions.digest('uno-audience:'||p.session_token,'sha256'),'hex')) visitor_hash FROM jsonb_array_elements(NEW.public_state->'players') person
   JOIN public.players p ON p.id::text=person->>'id' AND p.room_id=NEW.room_id
   WHERE NOT coalesce((person->>'isComputer')::boolean,false) AND (starts=1 OR (p.id::text=actor AND NOT coalesce((person->>'isBot')::boolean,false)))
   ORDER BY visitor_hash LOOP
   IF seen->>member.id IS DISTINCT FROM d::text THEN
    PERFORM uno_private.record_visitor(member.visitor_hash,d);
    seen:=seen||jsonb_build_object(member.id,d::text);
   END IF;
  END LOOP;
 END IF;
 NEW.analytics_state:=jsonb_set(NEW.analytics_state,'{seen}',seen);
 RETURN NEW;
END $$;
