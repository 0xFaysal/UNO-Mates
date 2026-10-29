'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-yellow-400" />
              <h3 className="font-black text-white text-lg">HOW TO PLAY CLASSIC UNO</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-300 pr-2">
            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-yellow-400">🎯 Objective</h4>
              <p>Be the first player to legally play all cards in your hand.</p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-red-400">🃏 Matching Cards</h4>
              <p>
                On your turn, match a card in your hand by <span className="text-white font-semibold">color</span>,{' '}
                <span className="text-white font-semibold">number</span>, or <span className="text-white font-semibold">symbol</span> with the top discard card. Wild cards can be played anytime.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-blue-400">⚡ Action Cards</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-white">Skip:</strong> The next player loses their turn.</li>
                <li><strong className="text-white">Reverse:</strong> Reverses play direction. In a 2-player game, Reverse behaves like Skip.</li>
                <li><strong className="text-white">Draw Two (+2):</strong> Next player draws 2 cards and skips turn.</li>
                <li><strong className="text-white">Wild:</strong> Choose the active color for upcoming turns.</li>
                <li><strong className="text-white">Wild Draw Four (+4):</strong> Choose color. Targeted player draws 4 cards and loses turn, unless they challenge!</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-amber-400">⚖️ The +4 Challenge</h4>
              <p>
                Under official classic rules, you may only play Wild Draw Four if you hold NO cards matching the active color. The targeted player can choose to accept the 4 cards, or challenge! If the player bluffed, the offender draws 4 cards. If the play was legal, the challenger draws 6 cards!
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-emerald-400">🔥 Calling & Catching UNO</h4>
              <p>
                When you play down to 1 card, declare UNO! If an opponent catches you before you declare UNO, you must draw 2 penalty cards.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1 text-purple-400">🚫 Classic Restrictions</h4>
              <p>
                No stacking (+2 on +2 is prohibited). No jump-ins. Standard 108-card deck.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
