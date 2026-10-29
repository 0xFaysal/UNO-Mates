'use client';

import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { AlertCircle, Flame } from 'lucide-react';

interface UnoButtonProps {
  isArmed: boolean;
  isMyTurn: boolean;
  hasOneOrTwoCards: boolean;
  challengeableOpponentName: string | null;
  onToggleArm: () => void;
  onCatchUno: () => void;
}

export function UnoButton({
  isArmed,
  isMyTurn,
  hasOneOrTwoCards,
  challengeableOpponentName,
  onToggleArm,
  onCatchUno,
}: UnoButtonProps) {
  // If an opponent forgot to call UNO, show Catch UNO button!
  if (challengeableOpponentName) {
    return (
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={{
          scale: [1, 1.06, 1],
          boxShadow: [
            '0 0 0 rgba(239, 68, 68, 0.4)',
            '0 0 20px rgba(239, 68, 68, 0.9)',
            '0 0 0 rgba(239, 68, 68, 0.4)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        onClick={onCatchUno}
        className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold text-sm sm:text-base px-5 py-2.5 rounded-full border-2 border-yellow-300 shadow-xl cursor-pointer"
      >
        <AlertCircle className="w-5 h-5 text-yellow-300 animate-spin" />
        <span>CATCH {challengeableOpponentName.toUpperCase()}!</span>
      </motion.button>
    );
  }

  // Normal UNO declaration button
  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      animate={
        isArmed
          ? {
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 10px rgba(234, 179, 8, 0.5)',
                '0 0 25px rgba(234, 179, 8, 1)',
                '0 0 10px rgba(234, 179, 8, 0.5)',
              ],
            }
          : {}
      }
      transition={{ repeat: isArmed ? Infinity : 0, duration: 1 }}
      onClick={onToggleArm}
      className={cn(
        'relative px-5 py-2.5 rounded-full font-black text-sm sm:text-base tracking-wider uppercase transition-all shadow-lg flex items-center gap-1.5 cursor-pointer select-none',
        isArmed
          ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 text-slate-950 border-2 border-white'
          : hasOneOrTwoCards && isMyTurn
          ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white border-2 border-yellow-400 animate-pulse'
          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600'
      )}
    >
      <Flame className={cn('w-4 h-4', isArmed ? 'text-red-950' : 'text-amber-400')} />
      <span>{isArmed ? 'UNO ARMED!' : 'UNO'}</span>
    </motion.button>
  );
}
