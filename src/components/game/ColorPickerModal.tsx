'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CardColor } from '@/lib/game/types';

interface ColorPickerModalProps {
  isOpen: boolean;
  onSelectColor: (color: 'red' | 'yellow' | 'green' | 'blue') => void;
}

const COLORS: { name: 'red' | 'yellow' | 'green' | 'blue'; label: string; bg: string; border: string; glow: string }[] = [
  { name: 'red', label: 'RED', bg: 'bg-[#ff5555]', border: 'border-red-400', glow: 'shadow-red-500/50' },
  { name: 'yellow', label: 'YELLOW', bg: 'bg-[#ffaa00]', border: 'border-yellow-400', glow: 'shadow-yellow-500/50' },
  { name: 'green', label: 'GREEN', bg: 'bg-[#55aa55]', border: 'border-green-400', glow: 'shadow-green-500/50' },
  { name: 'blue', label: 'BLUE', bg: 'bg-[#5555ff]', border: 'border-blue-400', glow: 'shadow-blue-500/50' },
];

export function ColorPickerModal({ isOpen, onSelectColor }: ColorPickerModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center"
        >
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-1">
            CHOOSE ACTIVE COLOR
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mb-6">
            Select the color for next players to match
          </p>

          <div className="grid grid-cols-2 gap-4">
            {COLORS.map((c) => (
              <motion.button
                key={c.name}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectColor(c.name)}
                className={`h-24 sm:h-28 rounded-2xl ${c.bg} border-4 ${c.border} text-white font-black text-lg sm:text-xl shadow-lg ${c.glow} flex items-center justify-center tracking-wider transition-all cursor-pointer`}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
