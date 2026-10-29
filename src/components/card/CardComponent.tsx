'use client';

import React from 'react';
import { Card } from '@/lib/game/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface CardComponentProps {
  card?: Card | null;
  isBack?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hand';
  onClick?: () => void;
  className?: string;
  animate?: boolean;
}

export function CardComponent({
  card,
  isBack = false,
  isPlayable = false,
  isSelected = false,
  isDisabled = false,
  size = 'md',
  onClick,
  className,
  animate = true,
}: CardComponentProps) {
  // Dimensions
  const sizeClasses = {
    sm: 'w-12 h-18 sm:w-14 sm:h-21',
    md: 'w-18 h-27 sm:w-22 sm:h-33',
    lg: 'w-24 h-36 sm:w-28 sm:h-42',
    hand: 'w-16 h-24 sm:w-20 sm:h-30 md:w-24 md:h-36',
  }[size];

  const assetPath = isBack || !card ? '/cards/card_back.svg' : `/cards/${card.assetFile}`;

  const content = (
    <div
      onClick={!isDisabled ? onClick : undefined}
      className={cn(
        'relative select-none transition-all duration-200 cursor-pointer rounded-xl overflow-hidden',
        sizeClasses,
        // Card shadow & 3D bevel
        'shadow-md hover:shadow-xl',
        // Playable state highlight
        isPlayable && !isDisabled && 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900',
        // Selected state
        isSelected && '-translate-y-5 ring-4 ring-emerald-400 shadow-2xl scale-105 z-30',
        // Disabled state
        isDisabled && 'opacity-40 cursor-not-allowed filter grayscale-[30%]',
        className
      )}
      style={{
        aspectRatio: '2 / 3',
      }}
    >
      <img
        src={assetPath}
        alt={isBack ? 'Card Back' : `${card?.color} ${card?.value}`}
        className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
        loading="eager"
        draggable={false}
      />
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      whileHover={!isDisabled && !isSelected ? { y: -6, scale: 1.03 } : undefined}
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {content}
    </motion.div>
  );
}
