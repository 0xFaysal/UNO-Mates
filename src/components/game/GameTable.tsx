'use client';

import React, { useState } from 'react';
import { Card, CardColor, GameState, PlayerPublic } from '@/lib/game/types';
import { CardComponent } from '../card/CardComponent';
import { CardFan } from './CardFan';
import { UnoButton } from './UnoButton';
import { ColorPickerModal } from './ColorPickerModal';
import { Draw4ChallengeModal } from './Draw4ChallengeModal';
import { WinnerModal } from './WinnerModal';
import { ChatDrawer } from './ChatDrawer';
import { SettingsModal } from './SettingsModal';
import { RulesModal } from './RulesModal';
import { useGameStore } from '@/lib/client/useGameStore';
import { playSound } from '@/lib/client/sound';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCw,
  RotateCcw,
  MessageSquare,
  Settings,
  HelpCircle,
  Volume2,
  VolumeX,
  Crown,
  Wifi,
  WifiOff,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface GameTableProps {
  publicState: GameState;
  myHand: Card[];
  myPlayerId: string;
  roomCode: string;
  chatMessages: any[];
  onPlayCard: (cardId: string, hasCalledUno: boolean) => Promise<void>;
  onDrawCard: () => Promise<void>;
  onPassTurn: () => Promise<void>;
  onChooseColor: (color: 'red' | 'yellow' | 'green' | 'blue') => Promise<void>;
  onResolveDraw4Challenge: (challenge: boolean) => Promise<void>;
  onCallUno: () => Promise<void>;
  onCatchUno: (targetPlayerId: string) => Promise<void>;
  onRestartGame: () => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onReturnToLobby: () => void;
}

export function GameTable({
  publicState,
  myHand,
  myPlayerId,
  roomCode,
  chatMessages,
  onPlayCard,
  onDrawCard,
  onPassTurn,
  onChooseColor,
  onResolveDraw4Challenge,
  onCallUno,
  onCatchUno,
  onRestartGame,
  onSendMessage,
  onReturnToLobby,
}: GameTableProps) {
  const {
    soundEnabled,
    toggleSound,
    isChatOpen,
    setChatOpen,
    isSettingsOpen,
    setSettingsOpen,
    isRulesOpen,
    setRulesOpen,
    selectedCardId,
    setSelectedCardId,
    isUnoArmed,
    setIsUnoArmed,
    isColorPickerOpen,
    openColorPicker,
    closeColorPicker,
  } = useGameStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const me = publicState.players.find((p) => p.id === myPlayerId);
  const currentTurnPlayer = publicState.players[publicState.turnIndex];
  const isMyTurn = currentTurnPlayer?.id === myPlayerId;
  const isHost = me?.isHost || false;

  // Color helper
  const activeColorHex: Record<CardColor, string> = {
    red: '#ff5555',
    yellow: '#ffaa00',
    green: '#55aa55',
    blue: '#5555ff',
    wild: '#a855f7',
  };

  // Playable card checker
  const isCardPlayableCheck = (card: Card) => {
    if (card.color === 'wild') return true;
    if (card.color === publicState.activeColor) return true;
    if (card.value === publicState.topDiscard.value) return true;
    return false;
  };

  // Handle Play Card
  const handleExecutePlay = async (card: Card) => {
    if (!isMyTurn || isSubmitting) return;

    if (card.color === 'wild') {
      // If it's a wild card, open color picker first
      openColorPicker(card.value === 'draw4' ? 'draw4' : 'wild');
      return;
    }

    try {
      setIsSubmitting(true);
      if (soundEnabled) playSound.cardPlay();
      await onPlayCard(card.id, isUnoArmed);
      setSelectedCardId(null);
      setIsUnoArmed(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Wild Color Selection
  const handleColorSelected = async (chosenColor: 'red' | 'yellow' | 'green' | 'blue') => {
    try {
      closeColorPicker();
      setIsSubmitting(true);
      if (selectedCardId) {
        // Play the wild card first, then choose color
        await onPlayCard(selectedCardId, isUnoArmed);
        setSelectedCardId(null);
        setIsUnoArmed(false);
      }
      await onChooseColor(chosenColor);
      if (soundEnabled) playSound.cardPlay();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Draw Card
  const handleDrawCard = async () => {
    if (!isMyTurn || isSubmitting || publicState.drawnCardPlayableId) return;
    try {
      setIsSubmitting(true);
      if (soundEnabled) playSound.cardDraw();
      await onDrawCard();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if an opponent forgot to call UNO
  const challengeableOpponent = publicState.unoChallengeablePlayerId
    ? publicState.players.find((p) => p.id === publicState.unoChallengeablePlayerId && p.id !== myPlayerId)
    : null;

  // Wild Draw 4 challenge modal state
  const isDraw4PendingForMe =
    publicState.pendingAction.type === 'challenge_draw4' &&
    publicState.pendingAction.playerId === myPlayerId;
  const draw4Offender = publicState.players.find((p) => p.id === publicState.pendingAction.targetPlayerId);

  // Winner modal
  const isWinnerModalOpen = publicState.status === 'round_over' && publicState.winnerPlayerId !== null;
  const winnerPlayer = publicState.players.find((p) => p.id === publicState.winnerPlayerId);

  // Opponents list (excluding me)
  const opponents = publicState.players.filter((p) => p.id !== myPlayerId);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col justify-between overflow-hidden select-none bg-slate-950 font-sans">
      {/* Table felt background with deep rich radial gaming gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, #064e3b 0%, #022c22 45%, #051a14 75%, #020b08 100%)',
        }}
      />
      {/* Felt texture vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/30 to-black/85 pointer-events-none" />

      {/* TOP BAR: Room Code, Ticker, System Controls */}
      <header className="relative z-20 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-950/50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg">
            <span className="text-[10px] font-bold text-slate-400">ROOM</span>
            <span className="text-xs sm:text-sm font-black text-yellow-400 tracking-wider">
              {roomCode}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <span>{publicState.players.length} Players</span>
          </div>
        </div>

        {/* Center Live Action Ticker */}
        <div className="flex-1 max-w-md mx-2 text-center overflow-hidden">
          <div className="text-[11px] sm:text-xs font-semibold text-emerald-300 truncate drop-shadow">
            {publicState.lastActionDescription || 'Game in progress'}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            title="Room Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-yellow-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setRulesOpen(true)}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            title="Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* OPPONENTS AROUND THE TABLE (Smooth 2 to 10 players responsive wrap) */}
      <section className="relative z-10 w-full px-2 pt-2">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap max-w-4xl mx-auto">
          {opponents.map((player) => {
            const isTheirTurn = currentTurnPlayer?.id === player.id;
            const hasUno = player.cardCount === 1;

            return (
              <motion.div
                key={player.id}
                animate={isTheirTurn ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                transition={{ repeat: isTheirTurn ? Infinity : 0, duration: 1.5 }}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-2xl bg-slate-950/80 border transition-all ${
                  isTheirTurn
                    ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 ring-2 ring-yellow-400/50'
                    : 'border-slate-800/80'
                }`}
              >
                {/* Avatar */}
                <div
                  className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-xs text-white shadow-inner"
                  style={{ backgroundColor: player.avatarColor }}
                >
                  {player.name.charAt(0).toUpperCase()}
                  {player.isHost && (
                    <Crown className="w-3.5 h-3.5 text-yellow-300 absolute -top-1.5 -right-1 drop-shadow" />
                  )}
                  {/* Online/Offline status */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                      player.isOnline ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                </div>

                {/* Player details */}
                <div className="flex flex-col text-left">
                  <span className="text-[11px] sm:text-xs font-bold text-slate-200 max-w-[70px] sm:max-w-[85px] truncate">
                    {player.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Mini Card Back Icon + Count */}
                    <div className="flex items-center gap-0.5 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-black text-white">
                      <span>🃏</span>
                      <span>{player.cardCount}</span>
                    </div>
                    {hasUno && (
                      <span className="bg-red-600 text-white font-black text-[9px] px-1 rounded animate-pulse">
                        UNO
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CENTER OF TABLE: Draw Pile, Discard Pile, Turn Direction, Active Color */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-2">
        <div className="relative flex items-center justify-center gap-6 sm:gap-10">
          {/* Active Color Outer Glow Ambient */}
          <div
            className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl opacity-35 pointer-events-none transition-colors duration-500"
            style={{
              backgroundColor: activeColorHex[publicState.activeColor] || '#55aa55',
            }}
          />

          {/* TURN DIRECTION RING */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              animate={{ rotate: publicState.turnDirection === 1 ? 360 : -360 }}
              transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}
              className="w-56 h-56 sm:w-72 sm:h-72 rounded-full border border-dashed border-white/20 flex items-center justify-between p-2"
            >
              {publicState.turnDirection === 1 ? (
                <>
                  <RotateCw className="w-5 h-5 text-emerald-400/60" />
                  <RotateCw className="w-5 h-5 text-emerald-400/60" />
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5 text-emerald-400/60" />
                  <RotateCcw className="w-5 h-5 text-emerald-400/60" />
                </>
              )}
            </motion.div>
          </div>

          {/* DRAW PILE */}
          <div className="relative flex flex-col items-center">
            {/* Realistic card stack effect */}
            <div className="absolute -top-1 -left-1 w-20 h-30 sm:w-24 sm:h-36 rounded-xl bg-slate-900 border border-slate-700 shadow-sm pointer-events-none" />
            <div className="absolute -top-0.5 -left-0.5 w-20 h-30 sm:w-24 sm:h-36 rounded-xl bg-slate-800 border border-slate-700 shadow pointer-events-none" />

            <div
              onClick={handleDrawCard}
              className={`relative cursor-pointer transition-transform ${
                isMyTurn && !publicState.drawnCardPlayableId
                  ? 'hover:scale-105 active:scale-95 ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-950 rounded-xl'
                  : 'opacity-90'
              }`}
            >
              <CardComponent card={null} isBack size="md" animate={false} />
              {/* Badge: Cards remaining */}
              <div className="absolute -bottom-2 -right-2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-black text-slate-300 shadow-md">
                {publicState.drawPileCount}
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-2 tracking-wide uppercase">
              Draw Pile
            </span>
          </div>

          {/* DISCARD PILE */}
          <div className="relative flex flex-col items-center">
            <div
              className="relative rounded-xl transition-all duration-300"
              style={{
                boxShadow: `0 0 25px ${activeColorHex[publicState.activeColor]}80`,
              }}
            >
              {/* Active Color Ring */}
              <div
                className="absolute -inset-1.5 rounded-2xl border-2 pointer-events-none animate-pulse"
                style={{
                  borderColor: activeColorHex[publicState.activeColor],
                }}
              />
              <CardComponent card={publicState.topDiscard} size="md" animate={false} />
            </div>

            {/* Active Color Badge */}
            <div
              className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase text-white tracking-wider border border-white/20 flex items-center gap-1 shadow-md"
              style={{ backgroundColor: activeColorHex[publicState.activeColor] }}
            >
              <span>{publicState.activeColor}</span>
            </div>
          </div>
        </div>

        {/* TURN STATUS BANNER */}
        <div className="mt-4 flex flex-col items-center gap-1">
          {isMyTurn ? (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-yellow-400/20 tracking-wide flex items-center gap-1.5"
            >
              <span>★ YOUR TURN! Play a card or draw</span>
            </motion.div>
          ) : (
            <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: currentTurnPlayer?.avatarColor || '#fff' }}
              />
              <span>Waiting for {currentTurnPlayer?.name}&apos;s turn...</span>
            </div>
          )}
        </div>
      </main>

      {/* BOTTOM SECTION: Player's Controls, UNO Button & Private Hand */}
      <footer className="relative z-20 w-full flex flex-col items-center justify-end">
        {/* Controls Bar: UNO Button, Play Selected Button, Pass Button */}
        <div className="w-full max-w-4xl px-4 flex items-center justify-between gap-2 mb-1">
          {/* Left: UNO Button */}
          <UnoButton
            isArmed={isUnoArmed}
            isMyTurn={isMyTurn}
            hasOneOrTwoCards={myHand.length <= 2}
            challengeableOpponentName={challengeableOpponent?.name || null}
            onToggleArm={() => {
              if (soundEnabled) playSound.click();
              setIsUnoArmed(!isUnoArmed);
            }}
            onCatchUno={() => {
              if (challengeableOpponent) {
                if (soundEnabled) playSound.penalty();
                onCatchUno(challengeableOpponent.id);
              }
            }}
          />

          {/* Right Action: Play Selected Card or Pass */}
          <div className="flex items-center gap-2">
            {publicState.drawnCardPlayableId && isMyTurn && (
              <button
                onClick={onPassTurn}
                className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md"
              >
                Pass Turn
              </button>
            )}

            {selectedCardId && isMyTurn && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const card = myHand.find((c) => c.id === selectedCardId);
                  if (card) handleExecutePlay(card);
                }}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 cursor-pointer"
              >
                Play Card
              </motion.button>
            )}
          </div>
        </div>

        {/* Player's Hand Cards */}
        <CardFan
          hand={myHand}
          isMyTurn={isMyTurn}
          selectedCardId={selectedCardId}
          drawnCardPlayableId={publicState.drawnCardPlayableId}
          isPlayableCheck={isCardPlayableCheck}
          onSelectCard={(card) => {
            if (soundEnabled) playSound.click();
            setSelectedCardId(card.id);
          }}
          onPlayCard={handleExecutePlay}
        />
      </footer>

      {/* MODALS */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onSelectColor={handleColorSelected}
      />

      <Draw4ChallengeModal
        isOpen={isDraw4PendingForMe}
        offenderName={draw4Offender?.name || 'Opponent'}
        previousColor={publicState.pendingAction.previousActiveColor || 'red'}
        onAccept={() => {
          if (soundEnabled) playSound.cardDraw();
          onResolveDraw4Challenge(false);
        }}
        onChallenge={() => {
          if (soundEnabled) playSound.click();
          onResolveDraw4Challenge(true);
        }}
      />

      <WinnerModal
        isOpen={isWinnerModalOpen}
        winnerName={winnerPlayer?.name || 'Player'}
        winnerColor={winnerPlayer?.avatarColor || '#eab308'}
        isMeWinner={publicState.winnerPlayerId === myPlayerId}
        isHost={isHost}
        onRestartGame={onRestartGame}
        onReturnToLobby={onReturnToLobby}
      />

      <ChatDrawer
        isOpen={isChatOpen}
        messages={chatMessages}
        currentUserId={myPlayerId}
        onClose={() => setChatOpen(false)}
        onSendMessage={onSendMessage}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setRulesOpen(false)}
      />
    </div>
  );
}
