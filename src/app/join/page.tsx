'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Users, ArrowLeft } from 'lucide-react';

const AVATAR_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[1]);
  const [roomCode, setRoomCode] = useState(initialCode.toUpperCase());
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('uno_nickname');
    const savedColor = localStorage.getItem('uno_avatar_color');
    if (savedName) setNickname(savedName);
    if (savedColor && AVATAR_COLORS.includes(savedColor)) setSelectedColor(savedColor);
    if (initialCode) setRoomCode(initialCode.toUpperCase());
  }, [initialCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code');
      return;
    }
    const name = nickname.trim() || 'Player';

    setError(null);
    setIsJoining(true);

    localStorage.setItem('uno_nickname', name);
    localStorage.setItem('uno_avatar_color', selectedColor);

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, avatarColor: selectedColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join room');
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || 'Error joining room');
      setIsJoining(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
      {error && (
        <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-2xl text-xs text-red-200 text-center font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
            Room Code
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. A9B2X4"
            maxLength={6}
            className="w-full bg-slate-950 text-white font-black text-center text-xl tracking-widest uppercase px-4 py-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
            Your Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. CardNinja"
            maxLength={20}
            className="w-full bg-slate-950 text-white font-bold px-4 py-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            Avatar Color
          </label>
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                style={{ backgroundColor: c }}
                className={`w-9 h-9 rounded-full transition-transform cursor-pointer ${
                  selectedColor === c ? 'scale-115 ring-4 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isJoining}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
        >
          {isJoining ? 'Joining Room...' : 'Join Game Room'}
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans">
      <header className="relative z-10 max-w-md w-full mx-auto flex items-center justify-between pb-4">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <span className="font-black text-sm text-yellow-400">JOIN GAME</span>
      </header>

      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-4">
        <Suspense fallback={<div className="text-center text-slate-400">Loading...</div>}>
          <JoinForm />
        </Suspense>
      </main>

      <footer className="relative z-10 text-center text-xs text-slate-500 py-2">
        UNO Classic Multiplayer Web Game
      </footer>
    </div>
  );
}
