-- Game writes come from both the API and clock worker. Track both in the database.
-- Claim/retry bookkeeping is excluded: it must not prolong an abandoned table.
CREATE OR REPLACE FUNCTION uno_private.touch_game_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 NEW.updated_at:=statement_timestamp();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION uno_private.touch_game_activity() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION uno_private.touch_game_activity() TO service_role;
DROP TRIGGER IF EXISTS uno_game_activity ON public.game_states;
CREATE TRIGGER uno_game_activity BEFORE UPDATE OF public_state,secret_state,status ON public.game_states
 FOR EACH ROW EXECUTE FUNCTION uno_private.touch_game_activity();

-- Previous versions did not timestamp every move. Give existing results a full
-- grace period instead of interpreting an unreliable old timestamp as expiry.
UPDATE public.game_states SET updated_at=now() WHERE status IN ('round_over','game_over');
