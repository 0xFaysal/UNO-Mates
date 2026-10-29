'use client';

import React from 'react';
import { Card } from '@/lib/game/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import './card-feedback.css';

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

export function CardActionFrame() {
  return <span className="card-action-frame" aria-hidden="true"/>;
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
    hand: 'w-16 h-24 sm:w-20 sm:h-30',
  }[size];

  const assetPath = isBack || !card ? '/cards/card_back.svg' : `/cards/${card.assetFile}`;

  const Element = onClick ? 'button' : 'div';
  const content = (
    <Element
      type={onClick ? 'button' : undefined}
      disabled={onClick ? isDisabled : undefined}
      aria-label={onClick ? (isSelected ? 'Play ' : 'Select ') + card?.color + ' ' + card?.value : undefined}
      onClick={!isDisabled ? onClick : undefined}
      className={cn(
        'relative select-none transition-all duration-200 rounded-xl overflow-hidden',
        onClick && 'cursor-pointer',
        sizeClasses,
        // Card shadow & 3D bevel
        'shadow-md hover:shadow-xl',
        // Playable state highlight
        isPlayable && !isDisabled && 'ring-2 ring-yellow-400/70 ring-offset-1 ring-offset-slate-900',
        isPlayable && !isDisabled && !isSelected && onClick && 'card-play-hint',
        // Selected state
        isSelected && '-translate-y-5 ring-2 ring-yellow-300 shadow-2xl scale-105 z-30',
        // Disabled state
        isDisabled && 'card-unavailable cursor-not-allowed brightness-[.65] saturate-[.65]',
        className
      )}
      style={{
        aspectRatio: '2 / 3',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Cached local SVG card artwork requires no image transformations. */}
      <img
        src={assetPath}
        alt={isBack ? 'Card Back' : `${card?.color} ${card?.value}`}
        className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
        loading="eager"
        draggable={false}
      />
      {isPlayable && !isDisabled && !isSelected && onClick && <CardActionFrame/>}
    </Element>
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
