'use client';
import { useEffect, useRef, useState } from 'react';
import { getClientSupabase } from './supabase';
import { errorMessage } from '@/lib/errors';
import { forgetRoomCredentials, getRoomCredentials, RoomAccessError } from './room-credentials';
import type { GameSnapshot } from '@/lib/game/types';
import type {TableReaction} from '@/lib/game/reactions';
import type { ChatMessageRecord } from '@/lib/server/store';
let disconnecting: Promise<unknown> = Promise.resolve();
interface Callbacks {
 onSync: () => void;
 onAccessDenied?: () => void;
 onRemoved?: () => void;
 onLobby?: () => void;
 onPresence?: (ids: string[]) => void;
 onGame?: (snapshot: GameSnapshot) => void;
 onChat?: (message: ChatMessageRecord) => void;
 onReaction?: (reaction:TableReaction) => void;
}
export function useRoomRealtime(code: string, callbacks: Callbacks) {
 const handlers = useRef(callbacks);
 useEffect(() => { handlers.current = callbacks; });
 const [status, setStatus] = useState('Connecting to live updates…');
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
  const supabase = getClientSupabase();

  let cancelled = false;
  let checkedConnectionFailure = false;
  let syncTimer:ReturnType<typeof setTimeout>|undefined;
  let retryTimer:ReturnType<typeof setTimeout>|undefined;
  let retries=0;
  let connecting=false;
  const sync=()=>{
   clearTimeout(syncTimer);
   if(cancelled||navigator.onLine===false||document.visibilityState==='hidden')return;
   syncTimer=setTimeout(()=>{if(!cancelled)handlers.current.onSync();},150);
  };
  let refresh: ReturnType<typeof setTimeout>;
  const channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
  const subscribed = new Set<string>();
  async function connect() {
   if (!supabase) throw new Error('Live updates unavailable. Configure Supabase.');
   if(navigator.onLine===false){setStatus('Offline. Live updates resume when your connection returns.');return;}
   const data = await getRoomCredentials(code);
   if (cancelled) return;
   await disconnecting;
   if (cancelled) return;
   await supabase!.realtime.setAuth(data.accessToken);
   if (cancelled) return;
   if (!channels.length) {
    const removed = ({ payload }: { payload: { playerId: string } }) => {
     if (cancelled) return;
     if (payload.playerId !== data.playerId) { handlers.current.onLobby?.(); return; }
     forgetRoomCredentials(code); cancelled = true; clearTimeout(refresh);
     disconnecting = Promise.all(channels.map(channel => supabase?.removeChannel(channel)));
     (handlers.current.onRemoved || handlers.current.onAccessDenied)?.();
    };
    const room = supabase!.channel(data.roomTopic, { config: { private: true, presence: { key: data.playerId } } })
     .on('presence', { event: 'sync' }, () => handlers.current.onPresence?.(Object.keys(room.presenceState())))
     .on('broadcast', { event: 'lobby_update' }, () => handlers.current.onLobby?.())
     .on('broadcast', { event: 'lobby_member_removed' }, removed)
     .on('broadcast', { event: 'chat_message' }, ({ payload }) => handlers.current.onChat?.(payload));
    const player = supabase!.channel(data.playerTopic, { config: { private: true } })
     .on('broadcast', { event: 'table_reaction' }, ({ payload }) => handlers.current.onReaction?.(payload))
     .on('broadcast', { event: 'chat_message' }, ({ payload }) => handlers.current.onChat?.(payload))
     .on('broadcast', { event: 'state_updated' }, ({ payload }) => handlers.current.onGame?.(payload));
    // This identity-scoped channel remains authorized after a seat is removed.
    const control = supabase!.channel(data.controlTopic, { config: { private: true } })
     .on('broadcast', { event: 'lobby_member_removed' }, removed);
    for (const channel of [room, player, control]) {
     channels.push(channel);
     channel.subscribe((state) => {
      if (cancelled) return;
      if (state === 'SUBSCRIBED') {
       subscribed.add(channel.topic);
       if (channel === room) void room.track({ playerId: data.playerId });
       if (subscribed.size === 3) { checkedConnectionFailure = false; setStatus('Live'); sync(); }
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
       subscribed.delete(channel.topic);
       setStatus('Live connection interrupted. Reconnecting…');
       // One recovery read per interruption, never a polling fallback.
       if (!checkedConnectionFailure) { checkedConnectionFailure = true; sync(); }
      }
     });
    }
   }
   retries=0;
   // Credential renewal only, not polling game/chat endpoints.
   clearTimeout(refresh);
   refresh = setTimeout(connectSafely, Math.max(10000, (data.expiresAt * 1000 - Date.now() - 60000)));
  }
  const connectSafely=()=>{if(cancelled||connecting)return;connecting=true;void connect().catch(e=>{
   if(cancelled)return;
   if(e instanceof RoomAccessError&&[401,403,404].includes(e.status)){forgetRoomCredentials(code);handlers.current.onAccessDenied?.();return;}
   setStatus(errorMessage(e,'Live updates unavailable. Reconnect to continue.'));
   if(navigator.onLine!==false&&retries<5){retryTimer=setTimeout(connectSafely,Math.min(15000,1000*2**retries++)+Math.random()*500);}
  }).finally(()=>{connecting=false;});};
  connectSafely();
  const resume = () => { if (document.visibilityState === 'visible'&&navigator.onLine!==false) { if (subscribed.size === 3) setStatus('Live'); if(!channels.length){clearTimeout(retryTimer);connectSafely();}else sync(); } };
  const offline = () => setStatus('Offline. Live updates resume when your connection returns.');
  window.addEventListener('offline', offline);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
   cancelled = true; clearTimeout(refresh); clearTimeout(syncTimer); clearTimeout(retryTimer);
   window.removeEventListener('online', resume);
   window.removeEventListener('offline', offline);
   document.removeEventListener('visibilitychange', resume);
   disconnecting = Promise.all(channels.map(channel => supabase?.removeChannel(channel)));
  };
 }, [code, attempt]);
 return { status, reconnect: () => setAttempt(n => n + 1) };
}
