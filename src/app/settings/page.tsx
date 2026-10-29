'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Volume2, VolumeX, Music, Smartphone, ShieldCheck } from 'lucide-react';
import { useGameStore } from '@/lib/client/useGameStore';

export default function SettingsPage() {
  const router = useRouter();
  const {
    soundEnabled,
    musicEnabled,
    vibrationEnabled,
    toggleSound,
    toggleMusic,
    toggleVibration,
  } = useGameStore();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        <header className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-sm font-black text-yellow-400 uppercase tracking-wider">
            Settings
          </span>
        </header>

        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
          <h1 className="text-xl font-black text-white">Audio &amp; Feedback</h1>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-yellow-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-500" />
                )}
                <div>
                  <div className="text-sm font-bold text-white">Sound Effects</div>
                  <div className="text-xs text-slate-400">Card clicks, chimes, celebration</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={toggleSound}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold text-white">Background Music</div>
                  <div className="text-xs text-slate-400">Ambient beats</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={musicEnabled}
                onChange={toggleMusic}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="text-sm font-bold text-white">Haptic Vibration</div>
                  <div className="text-xs text-slate-400">Tactile mobile sensations</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={vibrationEnabled}
                onChange={toggleVibration}
                className="w-5 h-5 accent-yellow-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Preferences saved locally on your device</span>
          </div>
        </div>
      </div>
    </div>
  );
}
