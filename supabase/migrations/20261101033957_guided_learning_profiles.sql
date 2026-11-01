-- Learning preferences are separate from real-match/player analytics.
CREATE TABLE uno_private.learning_profiles(
 visitor_hash text PRIMARY KEY CHECK(visitor_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('offered','in_progress','completed','skipped','experienced')),
 lesson integer NOT NULL DEFAULT 0 CHECK(lesson BETWEEN 0 AND 28),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE uno_private.learning_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON uno_private.learning_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON uno_private.learning_profiles TO service_role;
CREATE FUNCTION public.uno_learning_profile(p_hash text,p_operation text DEFAULT 'status',p_lesson integer DEFAULT 0,p_existing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE profile uno_private.learning_profiles; first_offer boolean:=false; known boolean;
BEGIN
 IF p_hash !~ '^[a-f0-9]{64}$' OR p_operation NOT IN ('status','progress','completed','skipped','experienced') OR p_lesson NOT BETWEEN 0 AND 28 THEN RAISE EXCEPTION 'Invalid learning preference'; END IF;
 -- Serialize competing first visits/tabs without serializing unrelated players.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_hash,71983));
 SELECT * INTO profile FROM uno_private.learning_profiles WHERE visitor_hash=p_hash;
 IF NOT FOUND THEN
  known:=p_existing OR EXISTS(SELECT 1 FROM uno_private.analytics_visitors WHERE visitor_hash=p_hash);
  INSERT INTO uno_private.learning_profiles(visitor_hash,status) VALUES(p_hash,CASE WHEN known THEN 'experienced' ELSE 'offered' END) RETURNING * INTO profile;
  first_offer:=NOT known;
 END IF;
 IF p_operation='status' AND profile.status IN ('offered','in_progress') AND EXISTS(SELECT 1 FROM uno_private.analytics_visitors WHERE visitor_hash=p_hash) THEN
  UPDATE uno_private.learning_profiles SET status='experienced',updated_at=now() WHERE visitor_hash=p_hash RETURNING * INTO profile;first_offer:=false;
 END IF;
 IF p_operation='progress' AND profile.status IN ('offered','in_progress') THEN
  UPDATE uno_private.learning_profiles SET status='in_progress',lesson=greatest(lesson,p_lesson),updated_at=now() WHERE visitor_hash=p_hash RETURNING * INTO profile;
 ELSIF p_operation IN ('completed','skipped','experienced') THEN
  UPDATE uno_private.learning_profiles SET status=CASE WHEN status='completed' THEN status WHEN p_operation='completed' THEN 'completed' WHEN status IN ('skipped','experienced') THEN status ELSE p_operation END,
   lesson=CASE WHEN p_operation='completed' THEN 28 ELSE lesson END,updated_at=now() WHERE visitor_hash=p_hash RETURNING * INTO profile;
 ELSE UPDATE uno_private.learning_profiles SET updated_at=now() WHERE visitor_hash=p_hash; END IF;
 RETURN jsonb_build_object('status',profile.status,'lesson',profile.lesson,'showOffer',first_offer AND profile.status='offered');
END $$;
REVOKE ALL ON FUNCTION public.uno_learning_profile(text,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_learning_profile(text,text,integer,boolean) TO service_role;
CREATE FUNCTION uno_private.prune_learning_profiles() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 DELETE FROM uno_private.learning_profiles WHERE updated_at<now()-interval '365 days';
$$;
REVOKE ALL ON FUNCTION uno_private.prune_learning_profiles() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.prune_learning_profiles() TO service_role;
SELECT cron.schedule('uno-learning-cleanup','53 * * * *','SELECT uno_private.prune_learning_profiles()');
