'use client';
import { useEffect, useRef, useState } from 'react';
import { getClientSupabase,setRoomRealtimeAuth } from './supabase';
import { errorMessage } from '@/lib/errors';
import { forgetRoomCredentials, getRoomCredentials, RoomAccessError } from './room-credentials';
import type { GameSnapshot } from '@/lib/game/types';
import type {TableReaction} from '@/lib/game/reactions';
import type { ChatMessageRecord } from '@/lib/server/store';
import {RealtimeAssembler,type TableFrame,type HandFrame} from './realtime-assembler';
let disconnecting: Promise<unknown> = Promise.resolve();
interface Callbacks {
 onSync: () => void;
 onAccessDenied?: () => void;
 onRemoved?: () => void;
 onLobby?: () => void;
 onPresence?: (ids: string[]) => void;
 onGame?: (snapshot: GameSnapshot) => void;
 getSnapshot?:()=>GameSnapshot|null;
 onChat?: (message: ChatMessageRecord) => void;
 onReaction?: (reaction:TableReaction) => void;
}
export function useRoomRealtime(code: string, callbacks: Callbacks, enabled=true) {
 const handlers = useRef(callbacks);
 const observe=useRef<((snapshot:GameSnapshot|null|undefined)=>void)|null>(null);
 useEffect(() => { handlers.current = callbacks;observe.current?.(callbacks.getSnapshot?.()); });
 const [status, setStatus] = useState('Connecting to live updates…');
 const [attempt, setAttempt] = useState(0);
 useEffect(() => {
   if(!enabled)return;
  const supabase = getClientSupabase();

  let cancelled = false;
  let checkedConnectionFailure = false;
  let syncTimer:ReturnType<typeof setTimeout>|undefined;
  let retryTimer:ReturnType<typeof setTimeout>|undefined;
  let recoveryTimer:ReturnType<typeof setTimeout>|undefined;
  let assembler:RealtimeAssembler|null=null;
  let table:ReturnType<NonNullable<typeof supabase>['channel']>|null=null;
  let split=false;
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
  const ready=()=>channels.length>=3&&channels.every(channel=>subscribed.has(channel.topic));
  const recover=()=>{
   if(!assembler?.pending){clearTimeout(recoveryTimer);recoveryTimer=undefined;return;}
   if(recoveryTimer)return;
   recoveryTimer=setTimeout(()=>{recoveryTimer=undefined;if(!cancelled&&assembler?.pending)sync();},500);
  };
  function attach(channel:typeof channels[number],presence=false){
   channel.subscribe(state=>{
    if(cancelled||!channels.includes(channel))return;
    if(state==='SUBSCRIBED'){
     subscribed.add(channel.topic);
     if(presence)void channel.track({playerId:assembler!.playerId});
     if(ready()){checkedConnectionFailure=false;setStatus('Live');sync();}
    }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){
     subscribed.delete(channel.topic);setStatus('Live connection interrupted. Reconnecting…');
     if(!checkedConnectionFailure){checkedConnectionFailure=true;sync();}
    }
   });
  }
  function switchTable(){
   const state=assembler?.current;
   if(!split||!state?.roundId||!handlers.current.getSnapshot){
    if(table){subscribed.delete(table.topic);channels.splice(channels.indexOf(table),1);void supabase?.removeChannel(table);table=null;}
    return;
   }
   const topic='table:'+state.roomId+':'+state.roundId;
   if(table?.topic==='realtime:'+topic)return;
   if(table){subscribed.delete(table.topic);channels.splice(channels.indexOf(table),1);void supabase?.removeChannel(table);}
   table=supabase!.channel(topic,{config:{private:true}}).on('broadcast',{event:'table_state'},({payload})=>{
    if(cancelled)return;
    seed(handlers.current.getSnapshot?.());
    const snapshot=assembler?.public(payload as TableFrame);if(snapshot)handlers.current.onGame?.(snapshot);recover();
   });
   channels.push(table);attach(table);
  }
  function seed(snapshot:GameSnapshot|null|undefined){
   if(cancelled||!snapshot||!assembler)return;
   const queued=assembler.seed(snapshot);switchTable();recover();
   if(queued)queueMicrotask(()=>{if(!cancelled)handlers.current.onGame?.(queued);});
  }
  observe.current=seed;
  async function connect() {
   if (!supabase) throw new Error('Live updates unavailable. Configure Supabase.');
   if(navigator.onLine===false){setStatus('Offline. Live updates resume when your connection returns.');return;}
   const data = await getRoomCredentials(code);
   if (cancelled) return;
   await disconnecting;
   if (cancelled) return;
   await setRoomRealtimeAuth(data.accessToken);
   if (cancelled) return;
   if (!channels.length) {
    assembler=new RealtimeAssembler(data.playerId);split=data.protocol===2&&!data.legacySeat;
    const removed = ({ payload }: { payload: { playerId: string } }) => {
     if (cancelled) return;
     if (payload.playerId !== data.playerId) { handlers.current.onLobby?.(); return; }
     forgetRoomCredentials(code); cancelled = true; clearTimeout(refresh);clearTimeout(recoveryTimer);
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
     .on('broadcast',{event:'private_hand'},({payload})=>{
      if(cancelled)return;seed(handlers.current.getSnapshot?.());const snapshot=assembler?.privateHand(payload as HandFrame);if(snapshot)handlers.current.onGame?.(snapshot);recover();
     })
     .on('broadcast', { event: 'state_updated' }, ({ payload }) => {
      if(cancelled||!payload.publicState||!Array.isArray(payload.myHand)||payload.myPlayerId!==data.playerId)return;
      if(payload.realtimeLegacy===true)split=false;
      const queued=assembler?.seed(payload);handlers.current.onGame?.(payload);switchTable();recover();if(queued)handlers.current.onGame?.(queued);
     });
    // This identity-scoped channel remains authorized after a seat is removed.
    const control = supabase!.channel(data.controlTopic, { config: { private: true } })
     .on('broadcast', { event: 'lobby_member_removed' }, removed);
    channels.push(room,player,control);for(const channel of [room,player,control])attach(channel,channel===room);
    seed(handlers.current.getSnapshot?.());
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
  const resume = () => { if (document.visibilityState === 'visible'&&navigator.onLine!==false) { if (ready()) setStatus('Live'); if(!channels.length){clearTimeout(retryTimer);connectSafely();}else sync(); } };
  const offline = () => setStatus('Offline. Live updates resume when your connection returns.');
  window.addEventListener('offline', offline);
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  return () => {
   cancelled = true; clearTimeout(refresh); clearTimeout(syncTimer); clearTimeout(retryTimer);clearTimeout(recoveryTimer);if(observe.current===seed)observe.current=null;
   window.removeEventListener('online', resume);
   window.removeEventListener('offline', offline);
   document.removeEventListener('visibilitychange', resume);
   disconnecting = Promise.all(channels.map(channel => supabase?.removeChannel(channel)));
  };
 }, [code, attempt, enabled]);
 return { status, reconnect: () => setAttempt(n => n + 1) };
}
