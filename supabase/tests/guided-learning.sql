BEGIN;
DO $$
DECLARE h text:=encode(extensions.gen_random_bytes(32),'hex'); old_hash text:=encode(extensions.gen_random_bytes(32),'hex'); skip_hash text:=encode(extensions.gen_random_bytes(32),'hex'); p jsonb;
BEGIN
 p:=public.uno_learning_profile(h);IF p->>'showOffer'<>'true' THEN RAISE EXCEPTION 'New browser not offered';END IF;
 p:=public.uno_learning_profile(h);IF p->>'showOffer'<>'false' THEN RAISE EXCEPTION 'Offer repeated';END IF;
 PERFORM public.uno_learning_profile(h,'progress',4);p:=public.uno_learning_profile(h,'progress',2);IF (p->>'lesson')::integer<>4 THEN RAISE EXCEPTION 'Progress regressed';END IF;
 PERFORM public.uno_learning_profile(h,'completed',28);p:=public.uno_learning_profile(h,'progress',1);IF p->>'status'<>'completed' THEN RAISE EXCEPTION 'Replay reset completion';END IF;
 p:=public.uno_learning_profile(h,'skipped');IF p->>'status'<>'completed' THEN RAISE EXCEPTION 'Skip erased completion';END IF;
 PERFORM public.uno_learning_profile(skip_hash,'skipped');p:=public.uno_learning_profile(skip_hash,'progress',2);IF p->>'status'<>'skipped' THEN RAISE EXCEPTION 'Skip not sticky';END IF;
 INSERT INTO uno_private.analytics_visitors(visitor_hash,first_day,last_day) VALUES(old_hash,(now() AT TIME ZONE 'Asia/Dhaka')::date,(now() AT TIME ZONE 'Asia/Dhaka')::date);
 p:=public.uno_learning_profile(old_hash);IF p->>'status'<>'experienced' OR p->>'showOffer'<>'false' THEN RAISE EXCEPTION 'Played today confused with a beginner';END IF;
 IF has_function_privilege('anon','public.uno_learning_profile(text,text,integer,boolean)','EXECUTE') OR has_function_privilege('authenticated','public.uno_learning_profile(text,text,integer,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Learning profile RPC exposed';END IF;
END $$;
ROLLBACK;
