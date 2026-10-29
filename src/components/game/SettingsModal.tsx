'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Volume2, VolumeX, Music, Smartphone, ShieldCheck } from 'lucide-react';
import { useGameStore } from '@/lib/client/useGameStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    soundEnabled,
    musicEnabled,
    vibrationEnabled,
    toggleSound,
    toggleMusic,
    toggleVibration,
  } = useGameStore();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl max-w-sm w-full"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
            <h3 className="font-black text-white text-lg">GAME SETTINGS</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-yellow-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-500" />
                )}
                <div>
                  <div className="text-sm font-bold text-white">Sound Effects</div>
                  <div className="text-xs text-slate-400">Card snaps, draws, chimes</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={toggleSound}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold text-white">Ambient Beats</div>
                  <div className="text-xs text-slate-400">Background music</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={musicEnabled}
                onChange={toggleMusic}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm font-bold text-white">Haptic Vibration</div>
                  <div className="text-xs text-slate-400">Tactile mobile feedback</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={vibrationEnabled}
                onChange={toggleVibration}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>

            <div className="pt-2 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official Classic UNO Rules Enforced</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
