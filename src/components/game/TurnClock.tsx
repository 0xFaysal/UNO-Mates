'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Bot} from 'lucide-react';
import type {GameState} from '@/lib/game/types';
import {TURN_MS} from '@/lib/game/turn-clock';
import {playCue} from '@/lib/client/sound';
let clockNow=Date.now();
const clockListeners=new Set<()=>void>();
let clockTimer:ReturnType<typeof setInterval>|undefined;
const subscribeClock=(listener:()=>void)=>{
  clockListeners.add(listener);
  if(!clockTimer){clockNow=Date.now();clockTimer=setInterval(()=>{clockNow=Date.now();for(const notify of clockListeners)notify();},500);}
  return()=>{clockListeners.delete(listener);if(!clockListeners.size){clearInterval(clockTimer);clockTimer=undefined;}};
};
const clockSnapshot=()=>clockNow;
const serverClock=()=>0;
const idleClock=()=>()=>{};

export function useTurnExpired(game:GameState,offset:number){
  const [expired,setExpired]=useState<string|null>(null);
  const key=game.turnToken||String(game.turnDeadlineAt);
  useEffect(()=>{
    if(!game.turnDeadlineAt||game.status!=='playing'||game.openingDealPending)return;
    const timer=setTimeout(()=>setExpired(key),Math.max(0,game.turnDeadlineAt-Date.now()-offset));
    return()=>clearTimeout(timer);
  },[game.turnDeadlineAt,game.status,game.openingDealPending,key,offset]);
  return game.status==='playing'&&!game.openingDealPending&&Boolean(game.turnDeadlineAt)&&expired===key;
}

export function useTurnReady(game:GameState,offset:number){
  const [ready,setReady]=useState<string|null>(null);
  const key=game.turnToken||String(game.turnStartedAt);
  useEffect(()=>{
    if(game.openingDealPending||game.status!=='playing')return;
    const timer=setTimeout(()=>setReady(key),Math.max(0,(game.turnStartedAt||0)-Date.now()-offset));
    return()=>clearTimeout(timer);
  },[game.openingDealPending,game.status,game.turnStartedAt,key,offset]);
  return !game.openingDealPending&&(!game.turnStartedAt||ready===key);
}

export function TurnClock({game,myId,offset,dealing,variant='badge'}:{game:GameState;myId:string;offset:number;dealing:boolean;variant?:'badge'|'ring'}){
  const active=game.status==='playing'&&Boolean(game.turnDeadlineAt)&&!game.openingDealPending&&!dealing;
  const now=useSyncExternalStore(active?subscribeClock:idleClock,clockSnapshot,serverClock);
  const warned=useRef<string|null>(null);
  const player=game.players[game.turnIndex];
  const remaining=Math.max(0,Math.min(TURN_MS,(game.turnDeadlineAt||0)-now-offset));
  const seconds=Math.ceil(remaining/1000);
  const started=active&&now+offset>=(game.turnStartedAt||0);
  const bot=player?.isComputer||(player?.isBot&&!player.isOnline);
  useEffect(()=>{
    const key=game.turnToken||String(game.turnDeadlineAt);
    if(variant==='badge'&&started&&!bot&&player?.id===myId&&seconds>0&&seconds<=5&&warned.current!==key){warned.current=key;playCue('warning');}
  },[variant,started,bot,seconds,game.turnToken,game.turnDeadlineAt,player?.id,myId]);
  if(!started)return null;
  const urgent=!bot&&seconds<=5;
  if(variant==='ring')return <span className={'turn-seat-ring '+(urgent?'is-urgent':'')} aria-hidden="true" data-testid="turn-clock-ring">
    <svg viewBox="0 0 56 56" fill="none"><circle className="turn-ring-track" cx="28" cy="28" r="24" strokeWidth="3.5"/><circle key={game.turnToken} className="turn-ring-progress" cx="28" cy="28" r="24" pathLength="100" strokeWidth="3.5" strokeDasharray="100" strokeDashoffset={bot?0:100-remaining/TURN_MS*100} strokeLinecap="round"/></svg>
  </span>;
  return <><span className={'table-clock-badge '+(urgent?'is-urgent':'')} role="timer" aria-label={(player?.name||'Player')+': '+(bot?'auto-play':seconds+' seconds remaining')} data-testid="turn-clock" data-seconds={seconds}>
    {bot&&<Bot size={11} aria-hidden="true"/>}<strong>{bot?'Auto':seconds}<small>{!bot&&'s'}</small></strong>
  </span><span role="status" className="sr-only">{player?.id===myId&&urgent?(seconds===0?'Time is up.':'Five seconds left.') : ''}</span></>;
}
