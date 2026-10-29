'use client';

import React from 'react';
import { Card } from '@/lib/game/types';
import { CardComponent } from '../card/CardComponent';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'motion/react';

interface CardFanProps {
  hand: Card[];
  isMyTurn: boolean;
  selectedCardId: string | null;
  drawnCardPlayableId: string | null;
  isPlayableCheck: (card: Card) => boolean;
  onSelectCard: (card: Card) => void;
  onPlayCard: (card: Card) => void;
}

export function CardFan({
  hand,
  isMyTurn,
  selectedCardId,
  drawnCardPlayableId,
  isPlayableCheck,
  onSelectCard,
  onPlayCard,
}: CardFanProps) {
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
    <div className="w-full max-w-4xl mx-auto px-2 pb-2">
      <div
        className={cn(
          'flex items-center gap-2 sm:gap-3 overflow-x-auto py-6 px-4 no-scrollbar justify-start md:justify-center',
          'scroll-smooth snap-x snap-mandatory'
        )}
      >
        <AnimatePresence mode="popLayout">
          {hand.map((card, idx) => {
            const isPlayable = isMyTurn && isPlayableCheck(card);
            const isSelected = selectedCardId === card.id;
            const isRestrictedByDraw = drawnCardPlayableId !== null && drawnCardPlayableId !== card.id;
            const isDisabled = !isMyTurn || isRestrictedByDraw || (!isPlayable && !isSelected);

            return (
              <div
                key={card.id}
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
        </AnimatePresence>
      </div>
    </div>
  );
}
