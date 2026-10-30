'use client';

import React from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Draw4ChallengeModalProps {
  isOpen: boolean;
  offenderName: string;
  previousColor: string;
  onAccept: () => void;
  onChallenge: () => void;
}

export function Draw4ChallengeModal({
  isOpen,
  offenderName,
  previousColor,
  onAccept,
  onChallenge,
}: Draw4ChallengeModalProps) {
  if (!isOpen) return null;

  return (
    <MotionConfig reducedMotion="user"><AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className="bg-slate-900 border-2 border-red-500/50 p-6 rounded-3xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            WILD DRAW FOUR CHALLENGE!
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            <span className="font-bold text-white">{offenderName}</span> played a +4 against you!
            In official Classic UNO rules, +4 can only be played legally if they held no cards matching the previous color (<span className="font-bold uppercase text-yellow-400">{previousColor}</span>).
          </p>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs text-slate-300 mb-6 text-left space-y-1">
            <p>• If challenge <span className="text-emerald-400 font-bold">succeeds</span>: {offenderName} draws 4 cards! You draw 0.</p>
            <p>• If challenge <span className="text-rose-400 font-bold">fails</span>: You draw 4 + 2 = 6 cards!</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onAccept}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              Accept (+4)
            </button>

            <button
              onClick={onChallenge}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold text-sm shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-white" />
              CHALLENGE!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence></MotionConfig>
  );
}
