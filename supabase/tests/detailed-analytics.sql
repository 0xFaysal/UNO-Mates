-- Run against the installed migrations. Every fixture is rolled back.
BEGIN;
CREATE TEMP TABLE analytics_isolation_test(room_id uuid,public_state jsonb,status text,analytics_state jsonb);
CREATE TRIGGER analytics_isolation BEFORE INSERT ON analytics_isolation_test FOR EACH ROW EXECUTE FUNCTION uno_private.track_match_details();
-- A malformed analytics input must not reject the underlying write.
INSERT INTO analytics_isolation_test VALUES(pg_catalog.gen_random_uuid(),'{"players":{}}','playing',null);
DO $$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Dhaka')::date;
 fresh text:=encode(extensions.gen_random_bytes(32),'hex'); known_hash text:=encode(extensions.gen_random_bytes(32),'hex');
 before_n bigint;before_r bigint;after_n bigint;after_r bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM analytics_isolation_test WHERE analytics_state->>'incomplete'='true') THEN RAISE EXCEPTION 'Analytics failure was not isolated'; END IF;
 SELECT coalesce(sum(new_players),0),coalesce(sum(returning_players),0) INTO before_n,before_r FROM uno_private.analytics_audience_daily WHERE day=d;
 PERFORM uno_private.record_visitor(known_hash,d-1);
 PERFORM uno_private.record_visitor(known_hash,d);
 PERFORM uno_private.record_visitor(known_hash,d);
 PERFORM uno_private.record_visitor(fresh,d);
 PERFORM uno_private.record_visitor(fresh,d);
 SELECT new_players,returning_players INTO after_n,after_r FROM uno_private.analytics_audience_daily WHERE day=d;
 IF after_n<>before_n+1 OR after_r<>before_r+1 THEN RAISE EXCEPTION 'Daily cohort deduplication failed'; END IF;
 IF has_function_privilege('anon','public.uno_admin_dashboard(integer)','EXECUTE') OR has_function_privilege('authenticated','public.uno_admin_dashboard(integer)','EXECUTE') THEN RAISE EXCEPTION 'Dashboard RPC exposed'; END IF;
 IF has_table_privilege('authenticated','uno_private.analytics_visitors','SELECT') THEN RAISE EXCEPTION 'Visitor registry exposed'; END IF;
END $$;
ROLLBACK;
