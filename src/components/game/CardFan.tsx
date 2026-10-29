'use client';

import React, { useEffect, useRef } from 'react';
import { Card } from '@/lib/game/types';
import { CardComponent } from '../card/CardComponent';
import { cn } from '@/lib/utils';

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
    <div data-hand-target className="game-hand-target w-full max-w-4xl mx-auto px-2 pb-2">
      <div ref={scroll}
        className={cn(
          'flex items-center gap-2 sm:gap-3 overflow-x-auto py-6 px-4 no-scrollbar justify-start md:justify-center',
          'scroll-smooth snap-x snap-mandatory'
        )}
      >
          {hand.map((card, idx) => {
            const isPlayable = isMyTurn && isPlayableCheck(card);
            const isSelected = selectedCardId === card.id;
            const isRestrictedByDraw = drawnCardPlayableId !== null && drawnCardPlayableId !== card.id;
            const isDisabled = !isMyTurn || isRestrictedByDraw || (!isPlayable && !isSelected);

            return (
              <div
                key={card.id}
                data-card-id={card.id}
                className="flex-shrink-0 snap-center transition-transform"
                style={{
                  zIndex: isSelected ? 30 : idx + 1,
                }}
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
  );
}
