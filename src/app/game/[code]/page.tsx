'use client';

import { errorMessage } from '@/lib/errors';

import React, { useEffect,useState, use, useCallback, Suspense } from 'react';
import {TABLE_REACTIONS,acceptReaction,type TableReaction,type ReactionKey} from '@/lib/game/reactions';
import {useGameStore} from '@/lib/client/useGameStore';
import {playCue} from '@/lib/client/sound';
import { useRouter } from 'next/navigation';
import { predictPlay, predictDraw, predictPublicAction, acceptsSnapshot } from '@/lib/game/presentation';
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
  const [reactions,setReactions]=useState<TableReaction[]>([]);
  const seenReactions=useRef(new Set<string>());
  const reactionsEnabled=useGameStore(s=>s.reactionsEnabled);
  const [clockOffset,setClockOffset]=useState(0);
  const offsetRef=useRef(0);
  const receiveReaction=useCallback((reaction:TableReaction)=>{
    if(!reaction||typeof reaction.id!=='string'||typeof reaction.playerId!=='string'||typeof reaction.playerName!=='string'||!Number.isFinite(reaction.createdAt))return;
    if(seenReactions.current.has(reaction.id))return;
    seenReactions.current.add(reaction.id);
    if(seenReactions.current.size>120)seenReactions.current.delete(seenReactions.current.values().next().value!);
    const now=Date.now()+offsetRef.current;
    if(!useGameStore.getState().reactionsEnabled||Math.abs(now-reaction.createdAt)>3000)return;
    const definition=TABLE_REACTIONS.find(r=>r.key===reaction.key);
    if(!definition)return;
    setReactions(list=>acceptReaction(list,reaction,now));playCue(definition.sound);
  },[]);
  useEffect(()=>{
    if(!reactions.length)return;
    const remaining=Math.max(0,Math.min(...reactions.map(r=>r.createdAt+3000-Date.now()-clockOffset)));
    const timer=setTimeout(()=>setReactions(list=>list.filter(r=>Date.now()+offsetRef.current-r.createdAt<3000)),remaining+20);
    return()=>clearTimeout(timer);
  },[reactions,clockOffset]);

  const confirmed = useRef<GameSnapshot | null>(null);
  const pendingMove = useRef<{ id: string; baseVersion: number } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [resultsConfirmed, setResultsConfirmed] = useState(false);
  const [pendingDrawCount, setPendingDrawCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roundAgeMs, setRoundAgeMs] = useState(Number.POSITIVE_INFINITY);
  const onlinePlayers = useRef<string[] | null>(null);
  const reclaimRef=useRef<(()=>void)|null>(null),reclaimPending=useRef(false);
  const applyGame = useCallback((data: GameSnapshot) => {
    if (!acceptsSnapshot(confirmed.current?.publicState || null,data.publicState)) return;
    if (confirmed.current?.publicState.roundId !== data.publicState.roundId) {pendingMove.current = null;setReactions([]);seenReactions.current.clear();}
    if(Number.isFinite(data.serverNow)){offsetRef.current=data.serverNow!-Date.now();setClockOffset(offsetRef.current);}
    confirmed.current = {...data,myPlayerId:data.myPlayerId||confirmed.current?.myPlayerId};
    setResultsConfirmed(data.publicState.status === 'round_over');
    if (data.serverNow && data.publicState.roundStartedAt) setRoundAgeMs(data.serverNow - data.publicState.roundStartedAt);
    if (pendingMove.current && data.publicState.version <= pendingMove.current.baseVersion) return;
    setPublicState({ ...data.publicState, players: data.publicState.players.map(p => ({ ...p, isOnline: onlinePlayers.current ? onlinePlayers.current.includes(p.id) : p.isOnline })) }); setMyHand(data.myHand);
    if (data.myPlayerId) setMyPlayerId(data.myPlayerId);
    setLoading(false);
    reclaimRef.current?.();
  }, []);
  const reclaimControl=useCallback(()=>{
    const state=confirmed.current,own=state?.publicState.players.find(p=>p.id===state.myPlayerId);
    if(!state||!own||(!own.isBot&&!own.offlineMisses)||!onlinePlayers.current?.includes(own.id)||reclaimPending.current)return;
    reclaimPending.current=true;
    const baseVersion=state.publicState.version;
    let restored=false;
    void fetch('/api/game/'+code+'/reclaim',{method:'POST'}).then(async response=>{
      if(response.ok){applyGame(await response.json());restored=true;}
    }).catch(()=>{}).finally(()=>{
      reclaimPending.current=false;
      // A newer confirmed turn can arrive during this request. Restore that state once,
      // rather than losing the return-to-human signal or polling after network failures.
      if(restored&&confirmed.current&&confirmed.current.publicState.version>baseVersion)reclaimRef.current?.();
    });
  },[code,applyGame]);
  const openingReady=useCallback(async()=>{
    const game=confirmed.current?.publicState;
    if(!game?.openingDealPending||!game.roundId||!game.turnToken)return;
    const response=await fetch('/api/game/'+code+'/ready',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roundId:game.roundId,turnToken:game.turnToken})});
    const data=await response.json();
    if(!response.ok)throw new Error(errorMessage(data.error,'Could not start your turn.'));
    applyGame(data);
  },[code,applyGame]);
  useEffect(()=>{reclaimRef.current=reclaimControl;return()=>{reclaimRef.current=null;};},[reclaimControl]);

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
      if (data.roomStatus === 'lobby') { router.replace('/room/' + code); return; }
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
    onLobby: () => { void fetchGameState(); },
    onGame: applyGame,
    onReaction:receiveReaction,
    onPresence: ids => { onlinePlayers.current = ids; setPublicState(previous => previous ? { ...previous, players: previous.players.map(p => ({ ...p, isOnline: ids.includes(p.id) })) } : previous);reclaimRef.current?.(); },
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
  const handleSendReaction=async(key:ReactionKey)=>{
    const response=await fetch('/api/rooms/'+code+'/reactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
    const data=await response.json();
    if(!response.ok)throw new Error(errorMessage(data.error,'Could not send reaction.'));
    receiveReaction(data.reaction);
  };

  const handleReturnToLobby = async () => {
    const state = confirmed.current?.publicState;
    if (!state) throw new Error('The table is still connecting.');
    const response = await fetch('/api/rooms/' + code + '/return-to-lobby', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: state.version, roundId: state.roundId || null }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data.error,'Could not return the table to the lobby.'));
    router.replace(`/room/${code}`);
  };

  if (loading || !publicState) {
    return <GameLoadingScreen roomCode={code} status={status} onReconnect={reconnect} />;
  }

  return (
    <>
    <p role="status" className="sr-only">{reactionsEnabled&&reactions.length?reactions.at(-1)!.playerName+': '+TABLE_REACTIONS.find(r=>r.key===reactions.at(-1)!.key)?.label:''}</p>
    {status !== 'Live' && <div role="status" className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-amber-300 px-3 py-2 rounded-xl text-xs">{status} <button onClick={reconnect} className="underline cursor-pointer">Reconnect</button></div>}
    {actionError && <div role="alert" aria-label="Move error" className="game-action-error">{actionError}<button onClick={() => setActionError(null)} aria-label="Dismiss move error">×</button></div>}
    <GameTable
      actionPending={actionPending}
      resultsConfirmed={resultsConfirmed}
      pendingDrawCount={pendingDrawCount}
      roundAgeMs={roundAgeMs}
      clockOffset={clockOffset}
      onOpeningReady={openingReady}
      reactions={reactionsEnabled?reactions:[]}
      onSendReaction={handleSendReaction}
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
