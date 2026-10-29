'use client';

import React, { useState, use, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { GameTable } from '@/components/game/GameTable';
import { Card, GameState } from '@/lib/game/types';
import { useRoomRealtime } from '@/lib/client/useRoomRealtime';
import type { ChatMessageRecord } from '@/lib/server/store';
import { useRef } from 'react';

export const dynamic = 'force-dynamic';

function GameContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [publicState, setPublicState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);

  const version = useRef(0);
  const onlinePlayers = useRef<string[] | null>(null);
  const applyGame = useCallback((data: { publicState: GameState; myHand: Card[]; myPlayerId?: string }) => {
    if (data.publicState.version < version.current) return;
    version.current = data.publicState.version;
    setPublicState({ ...data.publicState, players: data.publicState.players.map(p => ({ ...p, isOnline: onlinePlayers.current ? onlinePlayers.current.includes(p.id) : p.isOnline })) }); setMyHand(data.myHand);
    if (data.myPlayerId) setMyPlayerId(data.myPlayerId);
    setLoading(false);
  }, []);

  // Fetch Authoritative Game State & Caller Hand
  const fetchGameState = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${code}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push(`/join?code=${code}`);
          return;
        }
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync game state');
      }

      const data = await res.json();
      applyGame(data);
    } catch (err: unknown) {
      console.warn('Game state sync retry:', (err instanceof Error ? err.message : String(err)));
    }
  }, [code, router, applyGame]);

  // Fetch Chat Messages
  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(previous => Array.from(new Map([...previous, ...(data.messages || [])].map(m => [m.id, m])).values()).sort((a, b) => a.createdAt - b.createdAt).slice(-50));
      }
    } catch {
      console.warn('Chat sync failed');
    }
  }, [code]);

  const { status, reconnect } = useRoomRealtime(code, {
    onSync: () => { void fetchGameState(); void fetchChat(); },
    onGame: applyGame,
    onPresence: ids => { onlinePlayers.current = ids; setPublicState(previous => previous ? { ...previous, players: previous.players.map(p => ({ ...p, isOnline: ids.includes(p.id) })) } : previous); },
    onChat: message => setChatMessages(previous => previous.some(m => m.id === message.id) ? previous : [...previous, message].slice(-50)),
  });

  const dispatchAction = async (payload: Record<string, string | boolean>) => {
    const res = await fetch(`/api/game/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Action failed');
    }

    if (data.publicState) applyGame(data);
  };

  const handlePlayCard = async (cardId: string, hasCalledUno: boolean) => {
    await dispatchAction({ action: 'play_card', cardId, hasCalledUno });
  };

  const handleDrawCard = async () => {
    await dispatchAction({ action: 'draw_card' });
  };

  const handlePassTurn = async () => {
    await dispatchAction({ action: 'pass_turn' });
  };

  const handleChooseColor = async (color: 'red' | 'yellow' | 'green' | 'blue') => {
    await dispatchAction({ action: 'choose_color', color });
  };

  const handleResolveDraw4Challenge = async (challenge: boolean) => {
    await dispatchAction({ action: 'challenge_draw4', challenge });
  };

  const handleCallUno = async () => {
    await dispatchAction({ action: 'call_uno' });
  };

  const handleCatchUno = async (targetPlayerId: string) => {
    await dispatchAction({ action: 'catch_uno', targetPlayerId });
  };

  const handleRestartGame = async () => {
    await dispatchAction({ action: 'restart_game' });
  };

  const handleSendMessage = async (text: string) => {
    try {
      const res = await fetch(`/api/rooms/${code}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message failed');
      setChatMessages(previous => previous.some(m => m.id === data.message.id) ? previous : [...previous, data.message].slice(-50));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReturnToLobby = () => {
    router.push(`/room/${code}`);
  };

  if (loading || !publicState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold text-slate-300 tracking-wide">
          {status} <button onClick={reconnect} className="underline cursor-pointer">Reconnect</button>
        </span>
      </div>
    );
  }

  return (
    <>
    {status !== 'Live' && <div role="status" className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-amber-300 px-3 py-2 rounded-xl text-xs">{status} <button onClick={reconnect} className="underline cursor-pointer">Reconnect</button></div>}
    <GameTable
      publicState={publicState}
      myHand={myHand}
      myPlayerId={myPlayerId}
      roomCode={code}
      chatMessages={chatMessages}
      onPlayCard={handlePlayCard}
      onDrawCard={handleDrawCard}
      onPassTurn={handlePassTurn}
      onChooseColor={handleChooseColor}
      onResolveDraw4Challenge={handleResolveDraw4Challenge}
      onCallUno={handleCallUno}
      onCatchUno={handleCatchUno}
      onRestartGame={handleRestartGame}
      onSendMessage={handleSendMessage}
      onReturnToLobby={handleReturnToLobby}
    />
    </>
  );
}

export default function GamePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
          <span className="text-sm font-bold text-slate-300 tracking-wide">
            Loading table...
          </span>
        </div>
      }
    >
      <GameContent params={params} />
    </Suspense>
  );
}
