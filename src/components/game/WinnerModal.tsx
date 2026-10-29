'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import { playSound } from '@/lib/client/sound';

interface WinnerModalProps {
  isOpen: boolean;
  winnerName: string;
  winnerColor: string;
  isMeWinner: boolean;
  isHost: boolean;
  onRestartGame: () => void;
  onReturnToLobby: () => void;
}

export function WinnerModal({
  isOpen,
  winnerName,
  winnerColor,
  isMeWinner,
  isHost,
  onRestartGame,
  onReturnToLobby,
}: WinnerModalProps) {
  useEffect(() => {
    if (isOpen) {
      playSound.victory();
      // Fire confetti cannons
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
          });
          confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
          });
        }, 300);
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="bg-slate-900 border-2 border-yellow-400/60 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
        >
          {/* Glowing background ring */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

          <motion.div
            animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-20 h-20 bg-gradient-to-tr from-yellow-500 to-amber-300 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/40"
          >
            <Trophy className="w-10 h-10 text-slate-950" />
          </motion.div>

          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-red-400 mb-1">
            {isMeWinner ? 'YOU WON!' : 'ROUND WINNER!'}
          </h2>

          <div className="flex items-center justify-center gap-2 my-4">
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-white text-xs"
              style={{ backgroundColor: winnerColor }}
            >
              {winnerName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xl font-bold text-white">{winnerName}</span>
          </div>

          <p className="text-slate-400 text-xs sm:text-sm mb-6">
            {isMeWinner
              ? 'Congratulations! You legally played all your cards!'
              : `${winnerName} has played all their cards and won the round!`}
          </p>

          <div className="space-y-3">
            {isHost && (
              <button
                onClick={onRestartGame}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Play Another Round
              </button>
            )}

            <button
              onClick={onReturnToLobby}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return to Lobby
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
