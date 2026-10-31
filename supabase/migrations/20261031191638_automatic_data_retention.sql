-- Hourly, bounded cleanup. No HTTP requests and no browser polling.
-- Run as the cron owner's database role, never as an exposed SECURITY DEFINER RPC.
CREATE INDEX IF NOT EXISTS uno_players_auth_user ON public.players(auth_user_id)
 WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION uno_private.room_retention_expired(p_room_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce((SELECT
  (g.status IN ('round_over','game_over') OR
   (g.room_id IS NULL AND r.status IN ('lobby','finished','round_over')))
  AND greatest(r.updated_at,r.created_at,g.updated_at,
   (SELECT max(greatest(p.created_at,p.last_seen_at,u.last_sign_in_at))
    FROM public.players p LEFT JOIN auth.users u ON u.id=p.auth_user_id WHERE p.room_id=r.id),
   (SELECT max(created_at) FROM public.chat_messages WHERE room_id=r.id))
  < now()-CASE WHEN r.status='lobby' AND g.room_id IS NULL THEN interval '7 days' ELSE interval '24 hours' END
  FROM public.rooms r LEFT JOIN public.game_states g ON g.room_id=r.id WHERE r.id=p_room_id),false);
$$;
REVOKE ALL ON FUNCTION uno_private.room_retention_expired(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION uno_private.cleanup_expired_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 r public.rooms; g public.game_states; guest auth.users;
 removed_rooms integer:=0; removed_guests integer:=0;
BEGIN
 -- Concurrent/manual invocations must not multiply the batch or contend on auth rows.
 IF NOT pg_try_advisory_xact_lock(714018,1) THEN RETURN jsonb_build_object('busy',true); END IF;
 FOR r IN
  SELECT room.* FROM public.rooms room
  WHERE room.updated_at < now()-interval '24 hours'
   AND uno_private.room_retention_expired(room.id)
  ORDER BY room.updated_at LIMIT 100 FOR UPDATE OF room SKIP LOCKED
 LOOP
  -- Same room-then-game lock order as restart and final closing. Recheck after locks.
  SELECT * INTO g FROM public.game_states WHERE room_id=r.id FOR UPDATE;
  IF NOT uno_private.room_retention_expired(r.id) THEN CONTINUE; END IF;
  DELETE FROM public.rooms WHERE id=r.id;
  removed_rooms:=removed_rooms+1;
  -- Room FK cascades remove players, hands/deck, chat, events and reaction limits.
 END LOOP;

 -- Only this app's generated UUID identities, never real emails or linked members.
 -- Both auth ID and email's original player ID protect interrupted sign-in linking.
 FOR guest IN
  SELECT u.* FROM auth.users u
  WHERE u.email ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@guest[.]uno[.]invalid$'
   AND greatest(u.created_at,u.last_sign_in_at,u.updated_at)<now()-interval '7 days'
   AND NOT EXISTS(SELECT 1 FROM public.players p WHERE p.auth_user_id=u.id OR p.id::text=split_part(u.email,'@',1))
   AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.owner_id=u.id::text)
  ORDER BY u.created_at LIMIT 200 FOR UPDATE OF u SKIP LOCKED
 LOOP
  -- Auth's FK cascades revoke its persisted sessions/refresh tokens and identities.
  DELETE FROM auth.users WHERE id=guest.id;
  removed_guests:=removed_guests+1;
 END LOOP;
 DELETE FROM cron.job_run_details WHERE jobid IN
  (SELECT jobid FROM cron.job WHERE jobname='uno-data-cleanup')
  AND end_time<now()-interval '7 days';
 RETURN jsonb_build_object('rooms_deleted',removed_rooms,'guests_deleted',removed_guests);
END;
$$;
REVOKE ALL ON FUNCTION uno_private.cleanup_expired_data() FROM PUBLIC,anon,authenticated,service_role;
COMMENT ON FUNCTION uno_private.cleanup_expired_data() IS
 'Cron owner only: inactive completed tables 24h, unused lobbies 7d, unlinked app guest identities 7d. Playing states are excluded. Batches 100 rooms/200 guests.';
SELECT cron.schedule('uno-data-cleanup','43 * * * *','SELECT uno_private.cleanup_expired_data()');
