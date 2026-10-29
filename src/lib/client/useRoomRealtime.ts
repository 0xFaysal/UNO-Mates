'use client';
import { useEffect, useRef, useState } from 'react';
import { getClientSupabase } from './supabase';
import type { Card, GameState } from '@/lib/game/types';
import type { ChatMessageRecord } from '@/lib/server/store';
interface Credentials { accessToken: string; expiresAt: number; roomTopic: string; playerTopic: string; playerId: string }
const credentials = new Map<string, Credentials>();
const pending = new Map<string, Promise<Credentials>>();
let disconnecting: Promise<unknown> = Promise.resolve();
function getCredentials(code: string): Promise<Credentials> {
 const saved = credentials.get(code);
 if (saved && saved.expiresAt * 1000 > Date.now() + 90000) return Promise.resolve(saved);
 const existing = pending.get(code);
 if (existing) return existing;
 const request = fetch('/api/rooms/' + code + '/realtime', { method: 'POST' }).then(async res => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  credentials.set(code, data); return data as Credentials;
 }).finally(() => pending.delete(code));
 pending.set(code, request); return request;
}
interface Callbacks {
 onSync: () => void;
 onLobby?: () => void;
 onPresence?: (ids: string[]) => void;
 onGame?: (snapshot: { publicState: GameState; myHand: Card[]; myPlayerId: string }) => void;
 onChat?: (message: ChatMessageRecord) => void;
}
export function useRoomRealtime(code: string, callbacks: Callbacks) {
 const handlers = useRef(callbacks);
 useEffect(() => { handlers.current = callbacks; });
 const [status, setStatus] = useState('Connecting to live updates…');
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  const supabase = getClientSupabase();

  let cancelled = false;
  let refresh: ReturnType<typeof setTimeout>;
  const channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
  const subscribed = new Set<string>();
  async function connect() {
   if (!supabase) throw new Error('Live updates unavailable. Configure Supabase.');
   const data = await getCredentials(code);
   if (cancelled) return;
   await disconnecting;
   if (cancelled) return;
   await supabase!.realtime.setAuth(data.accessToken);
   if (cancelled) return;
   if (!channels.length) {
    const room = supabase!.channel(data.roomTopic, { config: { private: true, presence: { key: data.playerId } } })
     .on('presence', { event: 'sync' }, () => handlers.current.onPresence?.(Object.keys(room.presenceState())))
     .on('broadcast', { event: 'lobby_update' }, () => handlers.current.onLobby?.())
     .on('broadcast', { event: 'chat_message' }, ({ payload }) => handlers.current.onChat?.(payload));
    const player = supabase!.channel(data.playerTopic, { config: { private: true } })
     .on('broadcast', { event: 'state_updated' }, ({ payload }) => handlers.current.onGame?.(payload));
    for (const channel of [room, player]) {
     channels.push(channel);
     channel.subscribe((state) => {
      if (cancelled) return;
      if (state === 'SUBSCRIBED') {
       subscribed.add(channel.topic);
       if (channel === room) void room.track({ playerId: data.playerId });
       if (subscribed.size === 2) { setStatus('Live'); handlers.current.onSync(); }
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
       subscribed.delete(channel.topic);
       setStatus('Live connection interrupted. Reconnecting…');
      }
     });
    }
   }
   // Credential renewal only, not polling game/chat endpoints.
   refresh = setTimeout(() => { connect().catch(() => { if (!cancelled) setStatus('Live connection expired. Reconnect to continue.'); }); }, Math.max(10000, (data.expiresAt * 1000 - Date.now() - 60000)));
  }
  connect().catch(e => { if (!cancelled) setStatus(e.message || 'Live updates unavailable. Reconnect to continue.'); });
  const resume = () => { if (document.visibilityState === 'visible') { if (subscribed.size === 2) setStatus('Live'); handlers.current.onSync(); } };
  const offline = () => setStatus('Offline. Live updates resume when your connection returns.');
  window.addEventListener('offline', offline);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
   cancelled = true; clearTimeout(refresh);
   window.removeEventListener('online', resume);
   window.removeEventListener('offline', offline);
   document.removeEventListener('visibilitychange', resume);
   disconnecting = Promise.all(channels.map(channel => supabase?.removeChannel(channel)));
  };
 }, [code, attempt]);
 return { status, reconnect: () => setAttempt(n => n + 1) };
}
