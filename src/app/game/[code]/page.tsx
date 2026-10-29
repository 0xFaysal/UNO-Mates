'use client';

import { errorMessage } from '@/lib/errors';

import React, { useState, use, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { predictPlay, predictDraw, predictPublicAction } from '@/lib/game/presentation';
import { GameTable } from '@/components/game/GameTable';
import { GameLoadingScreen } from '@/components/game/GameLoadingScreen';
import { Card, GameState, GameSnapshot } from '@/lib/game/types';
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
  const confirmed = useRef<GameSnapshot | null>(null);
  const pendingMove = useRef<{ id: string; baseVersion: number } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [resultsConfirmed, setResultsConfirmed] = useState(false);
  const [pendingDrawCount, setPendingDrawCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roundAgeMs, setRoundAgeMs] = useState(Number.POSITIVE_INFINITY);
  const onlinePlayers = useRef<string[] | null>(null);
  const applyGame = useCallback((data: GameSnapshot) => {
    if (data.publicState.version < version.current) return;
    version.current = data.publicState.version;
    confirmed.current = data;
    setResultsConfirmed(data.publicState.status === 'round_over');
    if (data.serverNow && data.publicState.roundStartedAt) setRoundAgeMs(data.serverNow - data.publicState.roundStartedAt);
    if (pendingMove.current && data.publicState.version <= pendingMove.current.baseVersion) return;
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
      console.warn('Game state sync retry:', errorMessage(err));
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
    onAccessDenied: () => router.replace('/join?code=' + code),
    onSync: () => { void fetchGameState(); void fetchChat(); },
    onGame: applyGame,
    onPresence: ids => { onlinePlayers.current = ids; setPublicState(previous => previous ? { ...previous, players: previous.players.map(p => ({ ...p, isOnline: ids.includes(p.id) })) } : previous); },
    onChat: message => setChatMessages(previous => previous.some(m => m.id === message.id) ? previous : [...previous, message].slice(-50)),
  });

  const dispatchAction = async (payload: Record<string, string | boolean>) => {
    if (pendingMove.current) throw new Error('Your previous move is still being confirmed.');
    const base = confirmed.current;
    if (!base) throw new Error('The table is still connecting.');
    const requestId = crypto.randomUUID();
    pendingMove.current = { id: requestId, baseVersion: base.publicState.version };
    setActionPending(true); setActionError(null);
    try {
      if (payload.action === 'play_card') {
        const preview = predictPlay(base,myPlayerId,String(payload.cardId),Boolean(payload.hasCalledUno),requestId,payload.color as 'red'|'yellow'|'green'|'blue'|undefined);
        setPublicState(preview.publicState); setMyHand(preview.myHand);
      } else if (payload.action === 'draw_card') {
        const preview = predictDraw(base,myPlayerId,requestId);
        setPublicState(preview.snapshot.publicState); setPendingDrawCount(preview.count);
      } else if (['choose_color','pass_turn','call_uno'].includes(String(payload.action))) {
        const preview = predictPublicAction(base,myPlayerId,String(payload.action),requestId,payload.color as 'red'|'yellow'|'green'|'blue'|undefined);
        setPublicState(preview.publicState);
      }
      const res = await fetch('/api/game/' + code + '/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(errorMessage(data.error, 'Move was not saved. Please try again.'));
      pendingMove.current = null;
      if (data.publicState) applyGame(data);
    } catch (error) {
      pendingMove.current = null;
      const last = confirmed.current;
      if (last) { setPublicState(last.publicState); setMyHand(last.myHand); }
      setActionError(errorMessage(error,'Could not confirm your move. Reconnecting to the table.'));
      await fetchGameState();
      throw error;
    } finally {
      pendingMove.current = null; setActionPending(false); setPendingDrawCount(0);
    }
  };

  const handlePlayCard = async (cardId: string, hasCalledUno: boolean, color?: 'red'|'yellow'|'green'|'blue') => {
    await dispatchAction({ action: 'play_card', cardId, hasCalledUno, ...(color ? { color } : {}) });
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
    const res = await fetch('/api/rooms/' + code + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
    const data = await res.json();
    if (!res.ok) throw new Error(errorMessage(data.error,'Message not sent. Please try again.'));
    setChatMessages(previous => previous.some(m => m.id === data.message.id) ? previous : [...previous, data.message].slice(-50));
  };

  const handleReturnToLobby = () => {
    router.push(`/room/${code}`);
  };

  if (loading || !publicState) {
    return <GameLoadingScreen roomCode={code} status={status} onReconnect={reconnect} />;
  }

  return (
    <>
    {status !== 'Live' && <div role="status" className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-amber-300 px-3 py-2 rounded-xl text-xs">{status} <button onClick={reconnect} className="underline cursor-pointer">Reconnect</button></div>}
    {actionError && <div role="alert" aria-label="Move error" className="game-action-error">{actionError}<button onClick={() => setActionError(null)} aria-label="Dismiss move error">×</button></div>}
    <GameTable
      actionPending={actionPending}
      resultsConfirmed={resultsConfirmed}
      pendingDrawCount={pendingDrawCount}
      roundAgeMs={roundAgeMs}
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
      fallback={<GameLoadingScreen />}
    >
      <GameContent params={params} />
    </Suspense>
  );
}
