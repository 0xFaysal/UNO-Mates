'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyView } from '@/components/lobby/LobbyView';
import { getClientSupabase } from '@/lib/client/supabase';

export const dynamic = 'force-dynamic';

interface PlayerInLobby {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
}

function RoomLobbyContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInLobby[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  const fetchRoomState = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load room');

      if (data.room.status === 'playing') {
        router.push(`/game/${code}`);
        return;
      }

      setPlayers(data.players);
      if (data.me) {
        setMyPlayerId(data.me.id);
        setIsHost(data.me.isHost);
      } else {
        router.push(`/join?code=${code}`);
        return;
      }
      setLoading(false);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Error connecting to room');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomState();

    const supabase = getClientSupabase();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel(`room_${code}`)
        .on('broadcast', { event: 'lobby_update' }, () => {
          fetchRoomState();
        })
        .subscribe();
    }

    const interval = setInterval(fetchRoomState, 1500);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [code]);

  const handleToggleReady = async (ready: boolean) => {
    try {
      const res = await fetch(`/api/rooms/${code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady: ready }),
      });
      if (res.ok) {
        await fetchRoomState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartGame = async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start game');
      router.push(`/game/${code}`);
    } catch (e: unknown) {
      alert((e instanceof Error ? e.message : String(e)) || 'Failed to start game');
    }
  };

  const handleLeaveRoom = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold text-slate-400">Entering multiplayer lobby...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-red-950/80 border border-red-500/50 p-6 rounded-3xl max-w-sm w-full text-center space-y-4">
          <h2 className="text-lg font-black text-red-300">Room Error</h2>
          <p className="text-xs text-slate-300">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <LobbyView
      roomCode={code}
      players={players}
      myPlayerId={myPlayerId}
      isHost={isHost}
      onToggleReady={handleToggleReady}
      onStartGame={handleStartGame}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default function RoomLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
          <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <span className="text-sm font-bold text-slate-400">Loading Lobby...</span>
        </div>
      }
    >
      <RoomLobbyContent params={params} />
    </Suspense>
  );
}
