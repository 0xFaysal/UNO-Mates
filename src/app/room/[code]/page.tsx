'use client';

import { errorMessage } from '@/lib/errors';
import { GameLoadingScreen } from '@/components/game/GameLoadingScreen';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { forgetRoomCredentials } from '@/lib/client/room-credentials';
import { saveProfile } from '@/lib/client/profile';

import React, { useState, useRef, use, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyView, type PlayerInLobby } from '@/components/lobby/LobbyView';
import { useRoomRealtime } from '@/lib/client/useRoomRealtime';

export const dynamic = 'force-dynamic';

function RoomLobbyContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const onlinePlayers = useRef<string[] | null>(null);
  const roomRequest = useRef(0);
  const membershipEnded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInLobby[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);

  const endMembership = (removed = false) => {
    membershipEnded.current = true; roomRequest.current++;
    forgetRoomCredentials(code);
    router.replace('/join?code=' + code + (removed ? '&removed=1' : ''));
  };
  const fetchRoomState = async () => {
    if (membershipEnded.current) return;
    const request = ++roomRequest.current;
    try {
      const res = await fetch(`/api/rooms/${code}`);
      const data = await res.json();
      if (request !== roomRequest.current || membershipEnded.current) return;
      if (res.status === 401 || res.status === 403) { endMembership(res.status === 403); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load room');

      if (data.room.status === 'playing') {
        router.push(`/game/${code}`);
        return;
      }

      setPlayers(data.players.map((p: PlayerInLobby) => ({ ...p, isOnline: onlinePlayers.current ? onlinePlayers.current.includes(p.id) : p.isOnline })));
      if (data.me) {
        setMyPlayerId(data.me.id);
        setIsHost(data.me.isHost);
      } else {
        router.push(`/join?code=${code}`);
        return;
      }
      setLoading(false);
    } catch (err: unknown) {
      if (request !== roomRequest.current || membershipEnded.current) return;
      setError(errorMessage(err, 'Error connecting to room'));
      setLoading(false);
    }
  };

  const { status, reconnect } = useRoomRealtime(code, {
    onAccessDenied: () => endMembership(),
    onRemoved: () => endMembership(true),
    onSync: () => { void fetchRoomState(); },
    onLobby: () => { void fetchRoomState(); },
    onPresence: ids => { onlinePlayers.current = ids; setPlayers(previous => previous.map(p => ({ ...p, isOnline: ids.includes(p.id) }))); },
  });

  const handleChangeSeat = async (seatIndex: number, occupantId: string | null) => {
    const res = await fetch('/api/rooms/' + code + '/seat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seatIndex, expectedOccupantId: occupantId }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not move seats');
    await fetchRoomState();
  };

  const handleRename = async (name: string) => {
    const response = await fetch('/api/rooms/' + code + '/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data.error,'Could not change your name'));
    saveProfile(data.name, players.find(player => player.id === myPlayerId)?.avatarColor || '#ef4444');
    await fetchRoomState();
  };
  const handleAddBot=async()=>{
    const response=await fetch('/api/rooms/'+code+'/bots',{method:'POST'}),data=await response.json();
    if(!response.ok)throw new Error(errorMessage(data.error,'Could not add a bot'));
    await fetchRoomState();
  };
  const handleRemove = async (playerId: string) => {
    const response = await fetch('/api/rooms/' + code + '/players/' + playerId, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data.error,'Could not remove this player'));
    await fetchRoomState();
  };

  const handleToggleReady = async (ready: boolean) => {
    try {
      const res = await fetch(`/api/rooms/${code}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReady: ready }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change ready status');
      await fetchRoomState();
    } catch (e) {
      throw e;
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
      throw e;
    }
  };

  const handleLeaveRoom = () => {
    router.push('/');
  };

  if (loading) return <GameLoadingScreen roomCode={code} status={status} onReconnect={reconnect} />;

  if (error) {
    return (
      <div className="site-page min-h-screen flex flex-col items-center text-white p-4"><SiteHeader back/>
        <div role="alert" className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 my-auto">
          <h1 className="text-xl font-bold text-white">Couldn’t open this room</h1>
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
    <>
    {status !== 'Live' && <div role="status" className="text-center text-amber-300 text-xs p-2">{status} <button onClick={reconnect} className="underline cursor-pointer">Reconnect</button></div>}
    <LobbyView
      roomCode={code}
      players={players}
      myPlayerId={myPlayerId}
      isHost={isHost}
      onToggleReady={handleToggleReady}
      onChangeSeat={handleChangeSeat}
      onRename={handleRename}
      onRemovePlayer={handleRemove}
      onAddBot={handleAddBot}
      onStartGame={handleStartGame}
      onLeaveRoom={handleLeaveRoom}
    />
    </>
  );
}

export default function RoomLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={<GameLoadingScreen />}
    >
      <RoomLobbyContent params={params} />
    </Suspense>
  );
}
