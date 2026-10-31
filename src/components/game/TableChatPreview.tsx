'use client';
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import {MessageCircle} from 'lucide-react';
import {playerCharacter} from '@/lib/game/avatars';
import type {ChatMessageRecord} from '@/lib/server/store';
import './table-chat.css';

export function useTableChat(messages:ChatMessageRecord[],myId:string,open:boolean,scope:string,offset:number,blocked=false){
 const history=useRef<{scope:string;seen:Set<string>;since:number}|null>(null);
 const [unread,setUnread]=useState(0),[queue,setQueue]=useState<ChatMessageRecord[]>([]);
 useEffect(()=>{
  const previous=history.current;history.current={scope,seen:new Set(messages.slice(-100).map(message=>message.id)),since:previous?.scope===scope?previous.since:Date.now()+offset};
  if(!previous||previous.scope!==scope||open){setUnread(0);setQueue([]);return;}
  const now=Date.now()+offset;
  const fresh=messages.filter(message=>!previous.seen.has(message.id)&&message.playerId!==myId&&message.createdAt>=previous.since&&Math.abs(now-message.createdAt)<10000);
  if(!fresh.length)return;
  setUnread(count=>Math.min(99,count+fresh.length));
  if(!blocked&&document.visibilityState==='visible')setQueue(current=>[...current,...fresh].slice(-3));
 },[messages,myId,open,scope,offset,blocked]);
 useEffect(()=>{if(!blocked)return;const frame=requestAnimationFrame(()=>setQueue([]));return()=>cancelAnimationFrame(frame);},[blocked]);
 useEffect(()=>{const hide=()=>{if(document.hidden)setQueue([]);};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 const dismiss=useCallback((id:string)=>setQueue(current=>current.filter(message=>message.id!==id)),[]);
 return {unread,preview:queue[0],dismiss};
}

export function TableChatPreview({message,target,onDone,onOpen}:{message:ChatMessageRecord;target:RefObject<HTMLButtonElement|null>;onDone:(id:string)=>void;onOpen:()=>void}){
 const ref=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const bubble=ref.current;if(!bubble)return;
  const reduced=window.matchMedia('(prefers-reduced-motion:reduce)');let flight:Animation|undefined;
  const position=()=>{const dock=target.current?.closest('[data-testid="game-table"]')?.querySelector('.table-hand-dock')?.getBoundingClientRect();bubble.style.top=Math.max(68,Math.min((dock?.top??innerHeight*.75)-bubble.offsetHeight-12,innerHeight-bubble.offsetHeight-16))+'px';};
  position();window.addEventListener('resize',position);
  const timer=setTimeout(()=>{
   const destination=target.current?.getBoundingClientRect(),from=bubble.getBoundingClientRect();
   const dx=destination?destination.left+destination.width/2-from.left-from.width/2:0,dy=destination?destination.top+destination.height/2-from.top-from.height/2:-20;
   bubble.dataset.phase='flying';
   flight=bubble.animate(reduced.matches?[{opacity:1},{opacity:0}]:[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.65}px,${dy*.4}px) scale(.65)`,opacity:.95,offset:.55},{transform:`translate(${dx}px,${dy}px) scale(.05)`,opacity:0}],{duration:reduced.matches?160:680,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'});
   flight.onfinish=()=>{if(target.current&&!reduced.matches)target.current.animate([{transform:'scale(1)'},{transform:'scale(1.18)',backgroundColor:'#f7ca4333',offset:.4},{transform:'scale(1)'}],{duration:380});onDone(message.id);};
  },3400);
  return()=>{clearTimeout(timer);flight?.cancel();window.removeEventListener('resize',position);};
 },[message.id,target,onDone]);
 return <button ref={ref} type="button" className="table-chat-preview" data-testid="table-chat-preview" data-phase="reading" onClick={onOpen} aria-label={'Open chat: '+message.playerName+' says '+message.message}><span className="talk-avatar" style={{backgroundColor:message.playerColor}} aria-hidden="true">{playerCharacter(message.playerName)}</span><span className="table-chat-preview-copy"><span><strong>{message.playerName}</strong><small>just now</small></span><span className="table-chat-preview-text">{message.message}</span></span><MessageCircle size={15} aria-hidden="true"/></button>;
}
