'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play } from 'lucide-react';

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

export default function CreateRoomPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('uno_nickname');
    const savedColor = localStorage.getItem('uno_avatar_color');
    if (savedName) setNickname(savedName);
    if (savedColor && AVATAR_COLORS.includes(savedColor)) setSelectedColor(savedColor);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim() || 'Host';
    setError(null);
    setIsCreating(true);

    localStorage.setItem('uno_nickname', name);
    localStorage.setItem('uno_avatar_color', selectedColor);

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
        <span className="font-black text-sm text-yellow-400">CREATE ROOM</span>
      </header>

      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-4">
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-black text-white">Create Private Game</h2>
            <p className="text-xs text-slate-400 mt-1">
              You will be the room host and can invite up to 9 friends.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-2xl text-xs text-red-200 text-center font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                Your Host Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. HostMaster"
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
              disabled={isCreating}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{isCreating ? 'Creating Room...' : 'Create Room & Start Lobby'}</span>
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-slate-500 py-2">
        UNO Classic Multiplayer Web Game
      </footer>
    </div>
  );
}
