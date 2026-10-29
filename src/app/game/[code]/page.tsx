'use client';

import React, { useEffect, useState, use, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { GameTable } from '@/components/game/GameTable';
import { Card, GameState } from '@/lib/game/types';
import { getClientSupabase } from '@/lib/client/supabase';

export const dynamic = 'force-dynamic';

function GameContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [publicState, setPublicState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

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
      setPublicState(data.publicState);
      setMyHand(data.myHand);
      setMyPlayerId(data.myPlayerId);
      setLoading(false);
    } catch (err: unknown) {
      console.warn('Game state sync retry:', (err instanceof Error ? err.message : String(err)));
    }
  }, [code, router]);

  // Fetch Chat Messages
  const fetchChat = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (err) {
      console.warn('Chat sync retry');
    }
  }, [code]);

  useEffect(() => {
    fetchGameState();
    fetchChat();

    const supabase = getClientSupabase();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel(`game_${code}`)
        .on('broadcast', { event: 'state_updated' }, () => {
          fetchGameState();
        })
        .on('broadcast', { event: 'chat_message' }, () => {
          fetchChat();
        })
        .subscribe();
    }

    const interval = setInterval(() => {
      fetchGameState();
      fetchChat();
    }, 1200);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchGameState, fetchChat, code]);

  const dispatchAction = async (payload: any) => {
    const res = await fetch(`/api/game/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Action failed');
    }

    if (data.publicState) setPublicState(data.publicState);
    if (data.myHand) setMyHand(data.myHand);
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
      if (res.ok) {
        fetchChat();
      }
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
          Connecting to playing table...
        </span>
      </div>
    );
  }

  return (
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
