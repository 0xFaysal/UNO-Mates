'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Play, Users, BookOpen, ShieldCheck, Zap, Sparkles } from 'lucide-react';

const AVATAR_COLORS = [
  '#ef4444', // Red
  '#f59e0b', // Yellow
  '#10b981', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore saved nickname and avatar from localStorage
    const savedName = localStorage.getItem('uno_nickname');
    const savedColor = localStorage.getItem('uno_avatar_color');
    if (savedName) setNickname(savedName);
    if (savedColor && AVATAR_COLORS.includes(savedColor)) setSelectedColor(savedColor);
  }, []);

  const saveProfile = () => {
    if (nickname.trim()) {
      localStorage.setItem('uno_nickname', nickname.trim());
      localStorage.setItem('uno_avatar_color', selectedColor);
    }
  };

  const handleCreateRoom = async () => {
    const name = nickname.trim() || 'Player 1';
    setError(null);
    setIsCreating(true);
    saveProfile();

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatarColor: selectedColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');
      router.push(`/room/${data.roomCode}`);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Error creating room');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setError('Please enter a 6-character room code');
      return;
    }

    const name = nickname.trim() || 'Player';
    setError(null);
    setIsJoining(true);
    saveProfile();

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, avatarColor: selectedColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join room');
      router.push(`/room/${data.roomCode}`);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Error joining room');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/6 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-red-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/6 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-yellow-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-xl w-full mx-auto flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-red-600/30">
            UNO
          </div>
          <span className="font-black text-base sm:text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            CLASSIC ONLINE
          </span>
        </div>

        <button
          onClick={() => router.push('/rules')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Rules</span>
        </button>
      </header>

      {/* Hero and Form */}
      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-6 space-y-6">
        {/* Logo Title Banner */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="inline-block relative"
          >
            <h1 className="text-6xl sm:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 drop-shadow-xl select-none">
              UNO!
            </h1>
            <span className="absolute -top-1 -right-4 bg-red-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white rotate-12 shadow">
              Live
            </span>
          </motion.div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Play the real-time classic card game with 2 to 10 friends from any phone or computer!
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-950/70 border border-red-500/50 rounded-2xl text-xs text-red-200 text-center font-semibold"
          >
            {error}
          </motion.div>
        )}

        {/* Player Profile Setup Box */}
        <div className="bg-slate-900/90 border border-slate-800/90 p-5 rounded-3xl shadow-2xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Enter Your Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. MasterOfCards"
              maxLength={20}
              className="w-full bg-slate-950 text-white font-bold placeholder-slate-600 px-4 py-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-yellow-400 transition-colors text-sm sm:text-base"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
              Choose Avatar Color
            </label>
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-transform cursor-pointer shadow-md ${
                    selectedColor === c ? 'scale-115 ring-4 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ACTIONS: Create Room & Join Room */}
        <div className="space-y-3">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider shadow-xl shadow-red-600/25 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isCreating ? 'Creating Room...' : 'Create Private Room'}</span>
          </button>

          {/* Join Room Form */}
          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="6-LETTER CODE"
              maxLength={6}
              className="flex-1 bg-slate-900/90 text-white font-black text-center tracking-widest placeholder-slate-600 px-4 py-3.5 rounded-2xl border border-slate-800 focus:outline-none focus:border-yellow-400 text-sm sm:text-base uppercase"
            />
            <button
              type="submit"
              disabled={isJoining}
              className="py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm sm:text-base border border-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </form>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px] text-slate-400">
          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
            <Users className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
            <span>2 to 10 Players</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
            <Zap className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span>Real-Time Sync</span>
          </div>
          <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
            <ShieldCheck className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <span>Classic Rules</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-slate-500 py-2">
        UNO Classic Multiplayer Web Game • Free &amp; Open Source
      </footer>
    </div>
  );
}
