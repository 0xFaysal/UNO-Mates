import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Card, GameState, ServerAuthoritativeState } from '../game/types';
import { startNewGame } from '../game/engine';

export interface RoomRecord {
  id: string;
  code: string;
  hostPlayerId: string;
  status: 'lobby' | 'playing' | 'round_over' | 'finished';
  maxPlayers: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerRecord {
  id: string;
  roomId: string;
  sessionToken: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
  lastSeenAt: number;
  createdAt: number;
}

export interface ChatMessageRecord {
  id: string;
  roomId: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  message: string;
  createdAt: number;
}

// In-memory store for engine tests; configured deployments always use Supabase.
declare global {
  var __uno_rooms: Map<string, RoomRecord> | undefined;
  var __uno_players: Map<string, PlayerRecord> | undefined;
  var __uno_game_states: Map<string, ServerAuthoritativeState> | undefined;
  var __uno_chat: Map<string, ChatMessageRecord[]> | undefined;
}

if (!global.__uno_rooms) global.__uno_rooms = new Map();
if (!global.__uno_players) global.__uno_players = new Map();
if (!global.__uno_game_states) global.__uno_game_states = new Map();
if (!global.__uno_chat) global.__uno_chat = new Map();

const roomsMap = global.__uno_rooms!;
const playersMap = global.__uno_players!;
const gameStatesMap = global.__uno_game_states!;
const chatMap = global.__uno_chat!;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && !apiKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server persistence');
  if (url && apiKey) {
    return createClient(url, apiKey, {
      auth: { persistSession: false },
    });
  }
  return null;
}

/**
 * Generates an uppercase 6-character alphanumeric room code.
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a new room and sets host.
 */
export async function createRoom(
  hostName: string,
  hostAvatarColor: string,
  sessionToken: string
): Promise<{ room: RoomRecord; host: PlayerRecord }> {
  const supabase = getSupabaseClient();
  let code = generateRoomCode();

  // Ensure unique code
  while (roomsMap.has(code)) {
    code = generateRoomCode();
  }

  const roomId = crypto.randomUUID();
  const hostId = crypto.randomUUID();
  const now = Date.now();

  const room: RoomRecord = {
    id: roomId,
    code,
    hostPlayerId: hostId,
    status: 'lobby',
    maxPlayers: 10,
    createdAt: now,
    updatedAt: now,
  };

  const host: PlayerRecord = {
    id: hostId,
    roomId,
    sessionToken,
    name: hostName.trim().slice(0, 20) || 'Player 1',
    avatarColor: hostAvatarColor,
    isHost: true,
    isReady: true,
    isOnline: true,
    lastSeenAt: now,
    createdAt: now,
  };

  roomsMap.set(code, room);
  playersMap.set(hostId, host);

  if (supabase) {
    try {
      await supabase.from('rooms').insert({
        id: roomId,
        code,
        host_player_id: hostId,
        status: 'lobby',
        max_players: 10,
      }).throwOnError();

      await supabase.from('players').insert({
        id: hostId,
        room_id: roomId,
        session_token: sessionToken,
        name: host.name,
        avatar_color: host.avatarColor,
        is_host: true,
        is_ready: true,
        is_online: true,
      }).throwOnError();
    } catch (err) {
      throw err;
    }
  }

  return { room, host };
}

/**
 * Finds room by 6-char code.
 */
export async function getRoomByCode(code: string): Promise<RoomRecord | null> {
  const normalized = code.trim().toUpperCase();
  const room = roomsMap.get(normalized);
  if (room && !getSupabaseClient()) return room;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', normalized)
      .single();

    if (data) {
      const loaded: RoomRecord = {
        id: data.id,
        code: data.code,
        hostPlayerId: data.host_player_id,
        status: data.status,
        maxPlayers: data.max_players,
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.updated_at).getTime(),
      };
      roomsMap.set(normalized, loaded);
      return loaded;
    }
  }
  return null;
}

/**
 * Gets all players in a room.
 */
export async function getPlayersInRoom(roomId: string): Promise<PlayerRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('players').select('*').eq('room_id', roomId).order('created_at');
    if (error) throw error;
    const loaded: PlayerRecord[] = (data || []).map(p => ({
      id: p.id, roomId: p.room_id, sessionToken: p.session_token, name: p.name,
      avatarColor: p.avatar_color, isHost: p.is_host, isReady: p.is_ready,
      isOnline: p.is_online, lastSeenAt: Date.parse(p.last_seen_at), createdAt: Date.parse(p.created_at),
    }));
    for (const p of loaded) playersMap.set(p.id, p);
    return loaded;
  }
  const result: PlayerRecord[] = [];
  for (const player of playersMap.values()) {
    if (player.roomId === roomId) {
      result.push(player);
    }
  }
  result.sort((a, b) => a.createdAt - b.createdAt);
  return result;
}

/**
 * Finds a player by session token in a room.
 */
export async function getPlayerBySession(
  sessionToken: string,
  roomId: string
): Promise<PlayerRecord | null> {
  for (const player of await getPlayersInRoom(roomId)) {
    if (player.roomId === roomId && player.sessionToken === sessionToken) {
      return player;
    }
  }
  return null;
}

/**
 * Joins a room as a guest.
 */
export async function joinRoom(
  roomCode: string,
  name: string,
  avatarColor: string,
  sessionToken: string
): Promise<{ room: RoomRecord; player: PlayerRecord }> {
  const room = await getRoomByCode(roomCode);
  if (!room) {
    throw new Error('Room not found');
  }

  if (room.status !== 'lobby') {
    throw new Error('Game has already started in this room');
  }

  const existingPlayers = await getPlayersInRoom(room.id);

  // Check if player with this session token is already in room (reconnect)
  const existing = existingPlayers.find((p) => p.sessionToken === sessionToken);
  if (existing) {
    existing.isOnline = true;
    existing.lastSeenAt = Date.now();
    return { room, player: existing };
  }

  if (existingPlayers.length >= room.maxPlayers) {
    throw new Error('Room is full (maximum 10 players)');
  }

  const playerId = crypto.randomUUID();
  const now = Date.now();

  const newPlayer: PlayerRecord = {
    id: playerId,
    roomId: room.id,
    sessionToken,
    name: name.trim().slice(0, 20) || `Player ${existingPlayers.length + 1}`,
    avatarColor,
    isHost: false,
    isReady: false,
    isOnline: true,
    lastSeenAt: now,
    createdAt: now,
  };

  playersMap.set(playerId, newPlayer);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('players').insert({
        id: playerId,
        room_id: room.id,
        session_token: sessionToken,
        name: newPlayer.name,
        avatar_color: newPlayer.avatarColor,
        is_host: false,
        is_ready: false,
        is_online: true,
      }).throwOnError();

      // Broadcast room join event
      await supabase.from('game_events').insert({
        room_id: room.id,
        version: 1,
        event_type: 'player_joined',
        payload: { playerId, name: newPlayer.name },
      }).throwOnError();
    } catch (e) {
      throw e;
    }
  }

  return { room, player: newPlayer };
}

/**
 * Toggles a player's ready state.
 */
export async function setPlayerReady(
  playerId: string,
  isReady: boolean
): Promise<PlayerRecord> {
  const player = playersMap.get(playerId);
  if (!player) throw new Error('Player not found');
  player.isReady = isReady;

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('players').update({ is_ready: isReady }).eq('id', playerId).throwOnError();
  }
  return player;
}

/**
 * Starts the game in a room.
 */
export async function startGameInRoom(
  roomCode: string,
  hostPlayerId: string
): Promise<ServerAuthoritativeState> {
  const room = await getRoomByCode(roomCode);
  if (!room) throw new Error('Room not found');

  if (room.status !== 'lobby') throw new Error('Game has already started');

  if (room.hostPlayerId !== hostPlayerId) {
    throw new Error('Only the host can start the game');
  }

  const players = await getPlayersInRoom(room.id);
  if (players.length < 2) {
    throw new Error('At least 2 players are required to start');
  }

  if (players.length > 10) {
    throw new Error('Maximum 10 players allowed');
  }

  const notReady = players.find((p) => !p.isReady);
  if (notReady) {
    throw new Error(`All players must be ready. (${notReady.name} is not ready)`);
  }

  // Initialize game state with deterministic game engine
  const initialAuthoritativeState = startNewGame(
    room.id,
    players.map((p) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      isHost: p.isHost,
    }))
  );

  room.status = 'playing';
  room.updatedAt = Date.now();
  roomsMap.set(room.code, room);
  gameStatesMap.set(room.id, initialAuthoritativeState);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('game_states').insert({
        room_id: room.id,
        version: initialAuthoritativeState.gameState.version,
        status: 'playing',
        public_state: initialAuthoritativeState.gameState,
        secret_state: {
          drawPile: initialAuthoritativeState.drawPile,
          playerHands: initialAuthoritativeState.playerHands,
        },
      }).throwOnError();
      await supabase.from('rooms').update({ status: 'playing' }).eq('id', room.id).throwOnError();

      await supabase.from('game_events').insert({
        room_id: room.id,
        version: initialAuthoritativeState.gameState.version,
        event_type: 'game_started',
        payload: { version: initialAuthoritativeState.gameState.version },
      }).throwOnError();
    } catch (e) {
      throw e;
    }
  }

  return initialAuthoritativeState;
}

/**
 * Gets authoritative state for room.
 */
export async function getAuthoritativeState(roomId: string): Promise<ServerAuthoritativeState | null> {
  const cached = gameStatesMap.get(roomId);
  if (cached && !getSupabaseClient()) return cached;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (data) {
      const state: ServerAuthoritativeState = {
        gameState: data.public_state as GameState,
        drawPile: (data.secret_state as Pick<ServerAuthoritativeState, 'drawPile' | 'playerHands'>).drawPile as Card[],
        playerHands: (data.secret_state as Pick<ServerAuthoritativeState, 'drawPile' | 'playerHands'>).playerHands as Record<string, Card[]>,
      };
      gameStatesMap.set(roomId, state);
      return state;
    }
  }
  return null;
}

/**
 * Atomically updates authoritative game state and broadcasts version update.
 */
export async function saveAuthoritativeState(state: ServerAuthoritativeState, expectedVersion?: number): Promise<void> {
  const roomId = state.gameState.roomId;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('game_states').update({
      version: state.gameState.version, status: state.gameState.status,
      public_state: state.gameState,
      secret_state: { drawPile: state.drawPile, playerHands: state.playerHands },
    }).eq('room_id', roomId).eq('version', expectedVersion ?? state.gameState.version - 1).select('version');
    if (error) throw error;
    if (!data?.length) throw new Error('Game changed. Please try your move again.');
  }
  if (!supabase && expectedVersion !== undefined && gameStatesMap.get(roomId)?.gameState.version !== expectedVersion) {
    throw new Error('Game changed. Please try your move again.');
  }
  gameStatesMap.set(roomId, state);
}

/**
 * Adds a chat message in a room.
 */
export async function addChatMessage(
  roomId: string,
  playerId: string,
  playerName: string,
  playerColor: string,
  message: string
): Promise<ChatMessageRecord> {
  const trimmed = message.trim().slice(0, 150);
  const record: ChatMessageRecord = {
    id: crypto.randomUUID(),
    roomId,
    playerId,
    playerName,
    playerColor,
    message: trimmed,
    createdAt: Date.now(),
  };

  const list = chatMap.get(roomId) || [];
  list.push(record);
  if (list.length > 50) list.shift(); // keep last 50
  chatMap.set(roomId, list);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('chat_messages').insert({
        id: record.id,
        room_id: roomId,
        player_id: playerId,
        player_name: playerName,
        player_color: playerColor,
        message: trimmed,
      }).throwOnError();
    } catch (e) {
      throw e;
    }
  }

  return record;
}

/**
 * Gets chat messages for a room.
 */
export async function getChatMessages(roomId: string): Promise<ChatMessageRecord[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('chat_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return (data || []).reverse().map(m => ({ id: m.id, roomId: m.room_id, playerId: m.player_id, playerName: m.player_name, playerColor: m.player_color, message: m.message, createdAt: Date.parse(m.created_at) }));
  }
  return chatMap.get(roomId) || [];
}
