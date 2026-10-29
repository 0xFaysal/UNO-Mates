'use client';
import { contrastText } from '@/lib/client/contrast';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import type { GameState } from '@/lib/game/types';
import { playSound } from '@/lib/client/sound';
import { useGameStore } from '@/lib/client/useGameStore';
import { errorMessage } from '@/lib/errors';

interface WinnerModalProps {
  isOpen: boolean;
  game: GameState;
  myPlayerId: string;
  isHost: boolean;
  onRestartGame: () => Promise<void>;
  onReturnToLobby: () => void;
}

/** Final results stay on screen until the host starts the next round. */
export function WinnerModal({ isOpen, game, myPlayerId, isHost, onRestartGame, onReturnToLobby }: WinnerModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundEnabled = useGameStore(s => s.soundEnabled);
  const order = game.finishOrder?.length ? game.finishOrder : game.winnerPlayerId ? [game.winnerPlayerId] : [];
  const hasFullRankings = order.length === game.players.length;
  const ranked = order.flatMap(id => { const player = game.players.find(p => p.id === id); return player ? [player] : []; });
  const myRank = ranked.findIndex(p => p.id === myPlayerId) + 1;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!isOpen) { element.close(); return; }
    element.showModal();
    element.querySelector<HTMLElement>('#rankings-title')?.focus({ preventScroll: true });
    element.scrollTop = 0;
    if (soundEnabled) playSound.victory();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void confetti({ particleCount: 70, spread: 65, origin: { y: .5 }, disableForReducedMotion: true });
    }
    return () => element.close();
  }, [isOpen, soundEnabled]);

  async function restart() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onRestartGame(); }
    catch (err) { setError(errorMessage(err, 'Could not start the next round. Please try again.')); }
    finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} aria-labelledby="rankings-title" onCancel={event => event.preventDefault()} className="ranking-dashboard w-[calc(100%-24px)] max-w-md max-h-[calc(100dvh-32px)] m-auto p-0 rounded-3xl bg-slate-900 text-white border border-yellow-400/40 shadow-2xl">
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center"><Trophy aria-hidden="true" className="w-7 h-7" /></div>
          <div><p className="text-yellow-300 text-xs font-bold uppercase tracking-widest">Round complete</p><h2 id="rankings-title" tabIndex={-1} className="font-black text-2xl outline-none">{hasFullRankings ? 'Final rankings' : 'Round result'}</h2><p className="text-sm text-slate-300">{hasFullRankings ? 'You placed #' + myRank + ' of ' + ranked.length : 'Full rankings start with your next round.'}</p></div>
        </div>
        <ol aria-label="Player rankings" className="space-y-2">
          {ranked.map((player, index) => (
            <li key={player.id} data-testid="ranking-row" data-player-id={player.id} className={'flex items-center gap-3 rounded-2xl px-3 py-3 border ' + (index === 0 ? 'bg-yellow-400/10 border-yellow-400/40' : 'bg-slate-800/60 border-slate-700/70')}>
              <span className={'w-8 shrink-0 text-center font-black text-lg tabular-nums ' + (index === 0 ? 'text-yellow-300' : 'text-slate-400')}>#{index + 1}</span>
              <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: player.avatarColor, color: contrastText(player.avatarColor) }}>{player.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><p className="font-bold text-sm break-words">{player.name}{player.id === myPlayerId && <span className="text-slate-400 font-normal"> (You)</span>}</p><p className="text-xs text-slate-400">{index === 0 ? 'First to finish' : index === ranked.length - 1 ? 'Last remaining · ' + player.cardCount + (player.cardCount === 1 ? ' card' : ' cards') : 'Hand completed'}</p></div>
              {index === 0 && <Trophy aria-label="Winner" className="w-5 h-5 shrink-0 text-yellow-300" />}
            </li>
          ))}
        </ol>
        {error && <p role="alert" className="text-sm text-red-300 mt-4">{error}</p>}
        <div className="mt-5 space-y-2">
          {isHost ? <button disabled={busy} onClick={restart} className="w-full min-h-12 rounded-xl bg-yellow-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"><RotateCcw className="w-4 h-4" aria-hidden="true" />{busy ? 'Starting next round…' : 'Play Another Round'}</button> : <p role="status" className="text-xs text-center text-slate-400 py-2">Waiting for the host to start another round.</p>}
          <button disabled={busy} onClick={onReturnToLobby} className="w-full min-h-12 rounded-xl bg-slate-800 border border-slate-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"><Home className="w-4 h-4" aria-hidden="true" />Return to Lobby</button>
        </div>
      </div>
    </dialog>
  );
}
