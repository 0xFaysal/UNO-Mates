'use client';
import { useEffect,useRef,type RefObject } from 'react';
import type { GameState } from '@/lib/game/types';
import { useCelebrationCanvas } from './useCelebrationCanvas';

export function FinishConfetti({game,confirmed,table}:{game:GameState;confirmed:boolean;table:RefObject<HTMLDivElement|null>}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const progress=useRef<{round:string;seen:Set<string>}|null>(null);
 const {burst,reset}=useCelebrationCanvas(canvas);
 useEffect(()=>{
  if(!confirmed)return;
  const round=game.roundId||game.roomId,order=game.finishOrder||[];
  if(progress.current?.round!==round){
   // Opening/reloading an existing game is a baseline, not a new finish.
   progress.current={round,seen:new Set(order)};reset();return;
  }
  const fresh=order.filter(id=>!progress.current!.seen.has(id));
  for(const id of fresh)progress.current.seen.add(id);
  if(game.status!=='playing'){reset();return;} // Final results own the larger celebration.
  for(const id of fresh){
   const player=game.players.find(player=>player.id===id);
   if(!player||player.cardCount!==0)continue; // Never celebrate the automatic last place.
   const seat=table.current?.querySelector('[data-player-anchor="'+CSS.escape(id)+'"]')?.getBoundingClientRect();
   const origin={x:seat?Math.max(.06,Math.min(.94,(seat.left+seat.width/2)/innerWidth)):.5,y:seat?Math.max(.06,Math.min(.94,(seat.top+seat.height/2)/innerHeight)):.7};
   const rank=order.indexOf(id)+1;
   if(burst({particleCount:rank===1?56:32,spread:76,startVelocity:24,decay:.92,angle:Math.atan2(origin.y-.5,.5-origin.x)*180/Math.PI,origin,colors:['#f7ca43',player.avatarColor,'#f2f5ec','#83ca9c'],shapes:['square','circle']})){
    const node=canvas.current!;node.dataset.lastFinisher=id;node.dataset.celebrationCount=String(Number(node.dataset.celebrationCount||0)+1);
   }
  }
 },[game,confirmed,table,burst,reset]);
 return <canvas ref={canvas} className="finish-confetti-canvas" data-testid="finish-confetti" data-celebration-count="0" aria-hidden="true"/>;
}
