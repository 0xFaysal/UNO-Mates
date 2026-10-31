import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Card, GameState, ServerAuthoritativeState } from '../game/types';
import { startNewGame } from '../game/engine';
import {resumeOccupiedTable} from '../game/automation';
import {confirmOpeningReady} from '../game/turn-clock';
import { chooseNickname } from '../game/nicknames';
import { normalizeLobbyName, isValidLobbyName } from '../game/lobby-name';

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
  isComputer?:boolean;
  seatIndex: number;
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

let serverClient: {url:string;key:string;client:SupabaseClient}|undefined;

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && !apiKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server persistence');
  if (url && apiKey) {
    if (!serverClient || serverClient.url !== url || serverClient.key !== apiKey) {
      serverClient = {url,key:apiKey,client:createClient(url, apiKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })};
    }
    return serverClient.client;
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
    seatIndex: 0,
    id: hostId,
    roomId,
    sessionToken,
    name: chooseNickname(hostName),
    avatarColor: hostAvatarColor,
    isHost: true,
    isReady: true,
    isOnline: true,
    lastSeenAt: now,
    createdAt: now,
  };

  if (!supabase) { roomsMap.set(code, room); playersMap.set(hostId, host); }

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
        seat_index: 0,
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
    const { data, error } = await supabase.from('players').select('*').eq('room_id', roomId).order('seat_index');
    if (error) throw error;
    const loaded: PlayerRecord[] = (data || []).map(p => ({
      isComputer:Boolean(p.is_computer), seatIndex: p.seat_index, id: p.id, roomId: p.room_id, sessionToken: p.session_token, name: p.name,
      avatarColor: p.avatar_color, isHost: p.is_host, isReady: p.is_ready,
      isOnline: p.is_online, lastSeenAt: Date.parse(p.last_seen_at), createdAt: Date.parse(p.created_at),
    }));
    return loaded;
  }
  const result: PlayerRecord[] = [];
  for (const player of playersMap.values()) {
    if (player.roomId === roomId) {
      result.push(player);
    }
  }
  result.sort((a, b) => a.seatIndex - b.seatIndex);
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
    if (player.roomId === roomId && player.sessionToken === sessionToken && !player.isComputer) {
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

  const existingPlayers = await getPlayersInRoom(room.id);

  // Check if player with this session token is already in room (reconnect)
  const existing = existingPlayers.find((p) => p.sessionToken === sessionToken);
  if (existing) {
    existing.isOnline = true;
    existing.lastSeenAt = Date.now();
    return { room, player: existing };
  }

  if (room.status === 'finished') throw new Error('This table is closed. Create a new room to play.');
  if (room.status !== 'lobby') throw new Error('Game has already started in this room');

  if (existingPlayers.length >= room.maxPlayers) {
    throw new Error('Room is full (maximum 10 players)');
  }

  const playerId = crypto.randomUUID();
  const now = Date.now();

  const newPlayer: PlayerRecord = {
    seatIndex: Array.from({ length: 10 }, (_, i) => i).find(i => !existingPlayers.some(p => p.seatIndex === i))!,
    id: playerId,
    roomId: room.id,
    sessionToken,
    name: chooseNickname(name, existingPlayers.map(p => p.name)),
    avatarColor,
    isHost: false,
    isReady: false,
    isOnline: true,
    lastSeenAt: now,
    createdAt: now,
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.rpc('uno_join_lobby', { p_room_id: room.id, p_player: {
      id: playerId, session_token: sessionToken, name: newPlayer.name, avatar_color: avatarColor,
    } });
    if (error) throw error;
    Object.assign(newPlayer, { id: data.id, name: data.name, seatIndex: data.seat_index,
      avatarColor: data.avatar_color, isHost: data.is_host, isReady: data.is_ready,
      isOnline: data.is_online, createdAt: Date.parse(data.created_at), lastSeenAt: Date.parse(data.last_seen_at) });
  }

  if (!supabase) playersMap.set(newPlayer.id, newPlayer);
  return { room, player: newPlayer };
}

/**
 * Toggles a player's ready state.
 */
export async function setPlayerReady(
  playerId: string,
  isReady: boolean
): Promise<PlayerRecord> {
  const supabase = getSupabaseClient();
  if (supabase) {
    const {data,error}=await supabase.from('players').update({is_ready:isReady}).eq('id',playerId).select('*').single();
    if(error)throw error;
    return {id:data.id,roomId:data.room_id,sessionToken:data.session_token,name:data.name,avatarColor:data.avatar_color,
      seatIndex:data.seat_index,isHost:data.is_host,isReady:data.is_ready,isOnline:data.is_online,
      lastSeenAt:Date.parse(data.last_seen_at),createdAt:Date.parse(data.created_at)};
  }
  const player=playersMap.get(playerId);
  if(!player)throw new Error('Player not found');
  player.isReady=isReady;
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
      isComputer: p.isComputer,
    }))
  );

  room.status = 'playing';
  room.updatedAt = Date.now();
  if (!getSupabaseClient()) { roomsMap.set(room.code, room); gameStatesMap.set(room.id, initialAuthoritativeState); }

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.rpc('uno_start_seated_game', {
      p_room_id: room.id, p_host: hostPlayerId, p_public: initialAuthoritativeState.gameState,
      p_secret: { drawPile: initialAuthoritativeState.drawPile, playerHands: initialAuthoritativeState.playerHands },
    });
    if (error) throw error;
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
      clock_dispatch_until:null,
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
  if (!supabase) gameStatesMap.set(roomId, state);
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

  const supabase = getSupabaseClient();
  if (!supabase) {
    const list = chatMap.get(roomId) || [];
    list.push(record);
    if (list.length > 50) list.shift();
    chatMap.set(roomId, list);
  }
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

/** Move or swap only while the room is waiting; the database serializes changes. */
export async function movePlayerSeat(roomId: string, playerId: string, seatIndex: number, expectedOccupantId: string | null = null): Promise<void> {
 if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex > 9) throw new Error('Invalid seat');
 const db = getSupabaseClient();
 if (db) {
  const { error } = await db.rpc('uno_move_seat', { p_room_id: roomId, p_player_id: playerId, p_seat: seatIndex, p_expected: expectedOccupantId });
  if (error) throw error;
  return;
 }
 const room = [...roomsMap.values()].find(r => r.id === roomId);
 if (!room || room.status !== 'lobby') throw new Error('Seats are locked once the game starts');
 const player = playersMap.get(playerId);
 if (!player || player.roomId !== roomId) throw new Error('Player not in room');
 const other = [...playersMap.values()].find(p => p.roomId === roomId && p.seatIndex === seatIndex);
 if ((other?.id || null) !== expectedOccupantId) throw new Error('That seat just changed. Please choose again');
 if (other) other.seatIndex = player.seatIndex;
 player.seatIndex = seatIndex;
}

export interface GameContext { roomId: string; roomStatus: RoomRecord['status']; playerId: string; isHost: boolean; state: ServerAuthoritativeState | null }
export async function getGameContext(code: string, session: string): Promise<GameContext | null> {
 const db = getSupabaseClient();
 if (db) {
  const { data, error } = await db.rpc('uno_game_context', { p_code: code, p_session: session });
  if (error) throw error;
  return data as GameContext | null;
 }
 const room = await getRoomByCode(code);
 if (!room) return null;
 const player = await getPlayerBySession(session,room.id);
 if (!player) return null;
 return { roomId: room.id, roomStatus: room.status, playerId: player.id, isHost: player.isHost, state: await getAuthoritativeState(room.id) };
}

/** Cookie-authenticated activity restores a returning person's control, even off-turn. */
export async function restoreHumanControl(code:string,session:string):Promise<GameContext|null>{
 for(let attempt=0;attempt<3;attempt++){
  const context=await getGameContext(code,session),state=context?.state;
  const actor=state?.gameState.players.find(p=>p.id===context?.playerId);
  if(!context||!state||state.gameState.status!=='playing'||!actor||actor.isComputer||(!actor.isBot&&!actor.offlineMisses&&state.gameState.emptySinceAt===undefined))return context;
  const next=structuredClone(state);
  next.gameState.players=next.gameState.players.map(p=>p.id===actor.id?{...p,isBot:false,offlineMisses:0,isOnline:true}:p);
  if(next.gameState.emptySinceAt!==undefined)next.gameState=resumeOccupiedTable(next.gameState);
  if(next.gameState.players[next.gameState.turnIndex]?.id===actor.id)next.gameState.automationAt=undefined;
  next.gameState.version++;next.gameState.updatedAt=Date.now();
  next.gameState.lastMove={id:crypto.randomUUID(),type:'presence',playerId:actor.id,draws:[]};
  try{await saveAuthoritativeState(next,state.gameState.version);return {...context,state:next};}
  catch(error){if(!(error instanceof Error)||!error.message.includes('Game changed'))throw error;}
 }
 return getGameContext(code,session);
}


export class LobbyOperationError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export async function acknowledgeDeal(code:string,session:string,roundId:string,token:string):Promise<GameContext|null>{
 for(let attempt=0;attempt<3;attempt++){
  const context=await getGameContext(code,session);
  if(!context?.state)return context;
  const game=confirmOpeningReady(context.state.gameState,context.playerId,roundId,token);
  if(game===context.state.gameState)return context;
  const next={...context.state,gameState:game};
  try{await saveAuthoritativeState(next,context.state.gameState.version);return {...context,state:next};}
  catch(error){if(!(error instanceof Error)||!error.message.includes('Game changed'))throw error;}
 }
 throw new Error('The table changed. Try again.');
}

/** Host-only transition after a completed round; the same members keep their seats. */
export async function returnRoomToLobby(code: string, session: string, version: number, roundId: string | null): Promise<void> {
  const db = getSupabaseClient();
  if (db) {
    const { error } = await db.rpc('uno_return_to_lobby', { p_code: code, p_session: session, p_version: version, p_round_id: roundId });
    if (error) throw error;
    return;
  }
  const context = await getGameContext(code, session);
  if (!context || !context.isHost) throw new LobbyOperationError('Only the host can return the table to the lobby', 403);
  if (context.roomStatus === 'lobby') return;
  const state = context.state?.gameState;
  if (!state || state.status !== 'round_over' || state.version !== version || (state.roundId || null) !== roundId) throw new LobbyOperationError('The round changed. Refresh the results and try again.');
  gameStatesMap.delete(context.roomId);
  const room = await getRoomByCode(code);
  room!.status = 'lobby';
  for (const player of await getPlayersInRoom(context.roomId)) player.isReady = player.isHost || Boolean(player.isComputer);
}
export function lobbyErrorStatus(error: unknown): number {
  if (error instanceof LobbyOperationError) return error.status;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  return code === '42501' ? 403 : code === 'P0002' ? 404 : code === '22023' ? 400 : 409;
}

/** Rename only the caller, with the same room lock used by game start. */
export async function renameLobbyPlayer(code: string, session: string, requestedName: string): Promise<string> {
  const name = normalizeLobbyName(requestedName);
  if (!isValidLobbyName(name)) throw new LobbyOperationError('Use a name with 1 to 20 characters', 400);
  const db = getSupabaseClient();
  if (db) {
    const { data, error } = await db.rpc('uno_rename_lobby_player', { p_code: code, p_session: session, p_name: name });
    if (error) throw error;
    return data as string;
  }
  const room = await getRoomByCode(code);
  if (!room) throw new LobbyOperationError('Room not found', 404);
  const player = await getPlayerBySession(session, room.id);
  if (!player) throw new LobbyOperationError('You are no longer in this room', 403);
  if (room.status !== 'lobby') throw new LobbyOperationError('Names are locked once the game starts');
  const players = await getPlayersInRoom(room.id);
  if (players.some(p => p.id !== player.id && p.name.toLowerCase() === name.toLowerCase())) throw new LobbyOperationError('That name is already taken in this room');
  player.name = name;
  return name;
}

/** Removal frees the seat; it is not a permanent ban from the room. */
export async function removeLobbyPlayer(code: string, session: string, targetId: string): Promise<void> {
  const db = getSupabaseClient();
  if (db) {
    const { error } = await db.rpc('uno_remove_lobby_player', { p_code: code, p_session: session, p_target: targetId });
    if (error) throw error;
    playersMap.delete(targetId);
    return;
  }
  const room = await getRoomByCode(code);
  if (!room) throw new LobbyOperationError('Room not found', 404);
  const actor = await getPlayerBySession(session, room.id);
  if (!actor || room.hostPlayerId !== actor.id) throw new LobbyOperationError('Only the host can remove players', 403);
  if (room.status !== 'lobby') throw new LobbyOperationError('Players cannot be removed after the game starts');
  if (targetId === actor.id) throw new LobbyOperationError('The host cannot remove themselves', 400);
  const target = playersMap.get(targetId);
  if (!target || target.roomId !== room.id) throw new LobbyOperationError('That player has already left this lobby');
  playersMap.delete(targetId);
}
