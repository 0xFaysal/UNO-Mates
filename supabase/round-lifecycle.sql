-- Host-only reset of a completed table. Preserve memberships, names and seats.
CREATE OR REPLACE FUNCTION public.uno_return_to_lobby(p_code text,p_session text,p_version integer,p_round_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.rooms; actor public.players; g public.game_states;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE code=upper(btrim(p_code)) FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Room not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO actor FROM public.players WHERE room_id=r.id AND session_token=p_session;
 IF actor.id IS NULL OR r.host_player_id IS DISTINCT FROM actor.id THEN RAISE EXCEPTION 'Only the host can return the table to the lobby' USING ERRCODE='42501'; END IF;
 IF r.status='lobby' THEN RETURN; END IF;
 SELECT * INTO g FROM public.game_states WHERE room_id=r.id FOR UPDATE;
 IF g.room_id IS NULL OR g.status<>'round_over' OR g.version IS DISTINCT FROM p_version OR g.public_state->>'roundId' IS DISTINCT FROM p_round_id THEN
  RAISE EXCEPTION 'The round changed. Refresh the results and try again.';
 END IF;
 DELETE FROM public.game_states WHERE room_id=r.id;
 UPDATE public.players SET is_ready=is_host WHERE room_id=r.id;
 UPDATE public.rooms SET status='lobby',updated_at=now() WHERE id=r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.uno_return_to_lobby(text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_return_to_lobby(text,text,integer,text) TO service_role;

-- A single member-scoped read also tells reconnecting game screens to go to the lobby.
CREATE OR REPLACE FUNCTION public.uno_game_context(p_code text,p_session text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('roomId',r.id,'roomStatus',r.status,'playerId',p.id,'isHost',p.is_host,
  'state',CASE WHEN g.room_id IS NULL THEN NULL ELSE jsonb_build_object(
   'gameState',g.public_state,'drawPile',g.secret_state->'drawPile','playerHands',g.secret_state->'playerHands') END)
 FROM public.rooms r JOIN public.players p ON p.room_id=r.id AND p.session_token=p_session
 LEFT JOIN public.game_states g ON g.room_id=r.id WHERE r.code=upper(trim(p_code));
$$;
REVOKE ALL ON FUNCTION public.uno_game_context(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.uno_game_context(text,text) TO service_role;
