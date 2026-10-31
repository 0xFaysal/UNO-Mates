-- Service-only final transition. The worker confirms empty Presence twice first.
-- Commit room and game together; a reconnect/move that wins the version race cancels closing.
CREATE OR REPLACE FUNCTION public.uno_close_abandoned_match(p_room_id uuid,p_expected_version integer,p_state jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM id FROM public.rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_state->>'status' IS DISTINCT FROM 'game_over'
  OR p_state->>'endReason' IS DISTINCT FROM 'all_offline'
  OR p_state->>'roomId' IS DISTINCT FROM p_room_id::text
  OR (p_state->>'version')::integer IS DISTINCT FROM p_expected_version+1 THEN
  RAISE EXCEPTION 'Invalid abandoned-match transition';
 END IF;
 UPDATE public.game_states SET status='game_over',version=p_expected_version+1,
  public_state=p_state,clock_dispatch_until=NULL,updated_at=now()
 WHERE room_id=p_room_id AND version=p_expected_version AND status='playing'
  AND public_state->>'emptySinceAt' IS NOT NULL
  AND public_state->>'roundId' IS NOT DISTINCT FROM p_state->>'roundId';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.rooms SET status='finished',updated_at=now() WHERE id=p_room_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.uno_close_abandoned_match(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_close_abandoned_match(uuid,integer,jsonb) TO service_role;
