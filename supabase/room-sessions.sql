-- One browser may join multiple rooms; each room retains one membership per session.
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_session_token_key;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.players'::regclass AND conname='players_room_session_unique') THEN
  ALTER TABLE public.players ADD CONSTRAINT players_room_session_unique UNIQUE(room_id,session_token);
 END IF;
END $$;
