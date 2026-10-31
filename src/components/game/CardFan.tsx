'use client';

import React, { useEffect, useRef, type CSSProperties } from 'react';
import { Card } from '@/lib/game/types';
import { CardComponent } from '../card/CardComponent';
import {ArrowUp,ChevronsDown} from 'lucide-react';

interface CardFanProps {
  hand: Card[];
  pendingDrawCount?: number;
  isMyTurn: boolean;
  turnKey: string;
  selectedCardId: string | null;
  drawnCardPlayableId: string | null;
  isPlayableCheck: (card: Card) => boolean;
  onSelectCard: (card: Card) => void;
  onPlayCard: (card: Card) => void;
}

export function CardFan({
  hand,
  pendingDrawCount = 0,
  isMyTurn,
  turnKey,
  selectedCardId,
  drawnCardPlayableId,
  isPlayableCheck,
  onSelectCard,
  onPlayCard,
}: CardFanProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const cuedTurn=useRef<string|null>(null);
  const previous = useRef({ count: hand.length, last: hand.at(-1)?.id });
  const last = hand.at(-1)?.id;
  useEffect(()=>{
    if(!isMyTurn||cuedTurn.current===turnKey||document.hidden)return;
    cuedTurn.current=turnKey;
    if(window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    const area=scroll.current;if(!area)return;
    const bounds=area.getBoundingClientRect();
    const targets=Array.from(area.querySelectorAll<HTMLElement>('.card-motion.is-interactive')).filter(node=>{const box=node.getBoundingClientRect();return box.right>bounds.left&&box.left<bounds.right;}).slice(0,4);
    if(!targets.length){const deck=area.closest('[data-testid="game-table"]')?.querySelector<HTMLElement>('[data-draw-pile]:not(:disabled)');if(deck)targets.push(deck);}
    const animations=targets.map((node,index)=>node.animate([{transform:'translateY(0)'},{transform:'translateY(-8px)',offset:.42},{transform:'translateY(0)'}],{duration:620,delay:index*65,easing:'cubic-bezier(.2,.7,.3,1)'}));
    const stop=()=>{if(document.hidden)animations.forEach(animation=>animation.cancel());};
    document.addEventListener('visibilitychange',stop);
    return()=>{animations.forEach(animation=>animation.cancel());document.removeEventListener('visibilitychange',stop);};
  },[isMyTurn,turnKey,selectedCardId]);
  useEffect(()=>{
    const area=scroll.current;
    if(!area||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)entry.target.toggleAttribute('data-card-offscreen',!entry.isIntersecting);
    },{root:area,rootMargin:'80px'});
    area.querySelectorAll('[data-card-id]').forEach(card=>observer.observe(card));
    return()=>observer.disconnect();
  },[hand.length,last]);
  useEffect(() => {
    const arrived = hand.length > previous.current.count && last !== previous.current.last;
    previous.current = { count: hand.length, last };
    if (!arrived && !pendingDrawCount) return;
    const frame = requestAnimationFrame(() => {
      const area = scroll.current;
      area?.scrollTo({ left: area.scrollWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hand.length, last, pendingDrawCount]);
  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    // If card was already selected, second tap plays it!
    if (selectedCardId === card.id) {
      if (isPlayableCheck(card)) {
        onPlayCard(card);
      }
    } else {
      onSelectCard(card);
    }
  };

  return (
    <div data-hand-target className="game-hand-target">
      {isMyTurn&&!selectedCardId&&<span className="table-hand-turn-cue" data-testid="hand-turn-cue" aria-hidden="true">{hand.some(isPlayableCheck)?<><span>PLAY</span><ChevronsDown size={15} strokeWidth={3}/></>:<><span>DRAW</span><ArrowUp size={14} strokeWidth={3}/></>}</span>}
      <div ref={scroll} className="table-hand-scroll" tabIndex={0} role="region" aria-label="Your cards. Scroll sideways to see more.">
       <div className="table-hand-row">
          {hand.map((card, idx) => {
            const isRestrictedByDraw = drawnCardPlayableId !== null && drawnCardPlayableId !== card.id;
            const isPlayable = isMyTurn && !isRestrictedByDraw && isPlayableCheck(card);
            const isDisabled = !isPlayable;
            const isSelected = selectedCardId === card.id && isPlayable;

            return (
              <div
                key={card.id}
                data-card-id={card.id}
                className="table-hand-card"
                style={{
                  zIndex: isSelected ? 30 : idx + 1,
                  '--hand-angle': Math.max(-7,Math.min(7,(idx-(hand.length-1)/2)*1.5))+'deg',
                  '--hand-dip': Math.min(6,Math.abs(idx-(hand.length-1)/2))+'px',
                } as CSSProperties}
              >
                <CardComponent
                  card={card}
                  size="hand"
                  isPlayable={isPlayable}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onClick={() => handleCardClick(card)}
                />
              </div>
            );
          })}
        {pendingDrawCount > 0 && <div className="pending-draw-card" data-testid="pending-draw"><CardComponent isBack size="hand" animate={false}/><span>+{pendingDrawCount}</span></div>}
       </div>
      </div>
    </div>
  );
}
