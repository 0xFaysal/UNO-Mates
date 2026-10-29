-- ========================================================================
-- Real-Time Multiplayer UNO Classic Database Schema
-- Production-ready for Supabase PostgreSQL + Supabase Realtime
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) UNIQUE NOT NULL,
    host_player_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby', -- 'lobby', 'playing', 'round_over', 'finished'
    max_players INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for instant room lookup by 6-char code
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);

-- 2. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    session_token VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(32) NOT NULL,
    avatar_color VARCHAR(20) NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT false,
    is_ready BOOLEAN NOT NULL DEFAULT false,
    is_online BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_players_room_id ON public.players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_session_token ON public.players(session_token);

-- 3. GAME STATES TABLE (Server-Authoritative)
-- public_state: contains open table data (discard, turn, active color, card counts)
-- secret_state: contains private hands and draw pile (SECURED SERVER-SIDE ONLY)
CREATE TABLE IF NOT EXISTS public.game_states (
    room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'playing',
    public_state JSONB NOT NULL,
    secret_state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. GAME EVENTS TABLE (For Realtime state change notifications)
CREATE TABLE IF NOT EXISTS public.game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    version INT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_game_events_room_id ON public.game_events(room_id);

-- 5. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    player_name VARCHAR(32) NOT NULL,
    player_color VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id, created_at);

-- ========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security: Secret state and hands are accessible ONLY via service-role
-- ========================================================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Rooms: Public can read rooms by code; all mutations via authorized API server
CREATE POLICY "Allow public read on rooms" ON public.rooms
    FOR SELECT USING (true);

-- Players: Public can read player list in room for lobby
CREATE POLICY "Allow public read on players" ON public.players
    FOR SELECT USING (true);

-- Game states: NEVER expose secret_state directly!
-- Only service role (Server API) can access game_states
CREATE POLICY "Deny public select on game_states" ON public.game_states
    FOR SELECT USING (false);

-- Game events: Clients can subscribe to minimal notification events for their room
CREATE POLICY "Allow public read on game events" ON public.game_events
    FOR SELECT USING (true);

-- Chat messages: Allow reading in room
CREATE POLICY "Allow public read on chat messages" ON public.chat_messages
    FOR SELECT USING (true);

-- Enable Supabase Realtime publication for game_events, rooms, players, and chat
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.rooms,
    public.players,
    public.game_events,
    public.chat_messages;
COMMIT;
