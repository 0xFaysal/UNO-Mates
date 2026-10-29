'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Crown,
  Copy,
  Check,
  Share2,
  Users,
  Play,
  LogOut,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface PlayerInLobby {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
}

interface LobbyViewProps {
  roomCode: string;
  players: PlayerInLobby[];
  myPlayerId: string;
  isHost: boolean;
  onToggleReady: (ready: boolean) => Promise<void>;
  onStartGame: () => Promise<void>;
  onLeaveRoom: () => void;
}

export function LobbyView({
  roomCode,
  players,
  myPlayerId,
  isHost,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
}: LobbyViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const me = players.find((p) => p.id === myPlayerId);
  const isMeReady = me?.isReady || false;
  const canStart = players.length >= 2 && players.every((p) => p.isReady);

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${roomCode}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join my UNO Game!',
          text: `Join my real-time multiplayer UNO game room! Room Code: ${roomCode}`,
          url: inviteUrl,
        });
      } catch (e) {
        // Fallback to clipboard
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleStartGame = async () => {
    if (!canStart || isStarting) return;
    try {
      setIsStarting(true);
      await onStartGame();
    } catch (e) {
      console.error(e);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-amber-500 to-yellow-400 flex items-center justify-center font-black text-slate-950 text-sm shadow-md">
            UNO
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-wide">GAME LOBBY</h1>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{players.length} / 10 Players</span>
            </div>
          </div>
        </div>

        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave</span>
        </button>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 max-w-xl w-full mx-auto my-auto py-6 space-y-6">
        {/* ROOM CODE & INVITATION LINK */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Room Invitation Code
            </span>
            <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 tracking-wider my-1">
              {roomCode}
            </div>
            <p className="text-xs text-slate-400">Share this code with 1 to 9 friends to play together!</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            <button
              onClick={handleCopyCode}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleNativeShare}
              className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 text-xs font-black text-slate-950 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Invite</span>
            </button>
          </div>
        </div>

        {/* CONNECTED PLAYERS LIST */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-400">
            <span>PLAYERS IN ROOM ({players.length})</span>
            <span>STATUS</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {players.map((p) => {
              const isMe = p.id === myPlayerId;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isMe
                      ? 'bg-slate-800/80 border-yellow-400/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="relative w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shadow-inner"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                      {p.isHost && (
                        <Crown className="w-4 h-4 text-yellow-300 absolute -top-1.5 -right-1 drop-shadow" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isMe && <span className="text-[10px] text-yellow-400 font-extrabold">(YOU)</span>}
                        {p.isHost && (
                          <span className="text-[10px] bg-yellow-400/20 text-yellow-300 px-1.5 py-0.2 rounded font-black">
                            HOST
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        {p.isOnline ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Online</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            <span>Offline</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ready Badge */}
                  <div>
                    {p.isReady ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full text-xs font-black">
                        <Check className="w-3.5 h-3.5" />
                        READY
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-full text-xs font-bold">
                        WAITING
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      {/* FOOTER ACTIONS: Ready button + Host Start button */}
      <footer className="relative z-10 max-w-xl w-full mx-auto pt-4 border-t border-slate-800 space-y-3">
        {/* Toggle Ready for non-host or host */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onToggleReady(!isMeReady)}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
              isMeReady
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{isMeReady ? 'I am Not Ready' : 'I am Ready!'}</span>
          </button>

          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={!canStart || isStarting}
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${
                canStart && !isStarting
                  ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 text-slate-950 shadow-amber-500/30 hover:brightness-110 cursor-pointer animate-pulse'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isStarting ? 'Starting...' : 'Start Game (Host)'}</span>
            </button>
          ) : (
            <div className="flex items-center justify-center text-xs text-slate-400 p-2 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
              <span>Waiting for host to start the game...</span>
            </div>
          )}
        </div>

        {isHost && !canStart && (
          <p className="text-center text-[11px] text-amber-400/90">
            {players.length < 2
              ? 'At least 2 players are required to start.'
              : 'All players must be marked READY before starting.'}
          </p>
        )}
      </footer>
    </div>
  );
}
