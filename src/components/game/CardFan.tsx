'use client';

import React, { useEffect, useRef, type CSSProperties } from 'react';
import { Card } from '@/lib/game/types';
import { CardComponent } from '../card/CardComponent';

interface CardFanProps {
  hand: Card[];
  pendingDrawCount?: number;
  isMyTurn: boolean;
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
  selectedCardId,
  drawnCardPlayableId,
  isPlayableCheck,
  onSelectCard,
  onPlayCard,
}: CardFanProps) {
  const scroll = useRef<HTMLDivElement>(null);
  const previous = useRef({ count: hand.length, last: hand.at(-1)?.id });
  const last = hand.at(-1)?.id;
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
