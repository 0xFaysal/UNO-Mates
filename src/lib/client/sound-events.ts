import type { GameState } from '../game/types';
import type { SoundCue } from './sound';

/** Snapshot-aware cues: request IDs are shared by optimistic and server moves. */
export function createGameSoundTracker() {
  let round: string | undefined;
  let initialized = false;
  let confirmed: GameState | null = null;
  let dealing = false;
  const seen = new Set<string>();
  return (game: GameState, myId: string, isConfirmed: boolean, isDealing: boolean): SoundCue[] => {
    const cues: SoundCue[] = [];
    const key = game.roundId || game.roomId;
    if (!initialized || round !== key) {
      initialized = true; round = key; confirmed = game; dealing = isDealing; seen.clear();
      if (game.lastMove) seen.add(game.lastMove.id);
      return cues; // A refresh/reconnect must not replay historical actions.
    }
    const move = game.lastMove;
    if (move && !seen.has(move.id)) {
      seen.add(move.id);
      if (seen.size > 160) seen.delete(seen.values().next().value!);
      if (!isDealing) {
        if (move.type === 'play' && move.card) {
          cues.push(/^\d$/.test(move.card.value) ? 'cardPlay' : move.card.value as SoundCue);
          if (game.players.find(p => p.id === move.playerId)?.hasCalledUno) cues.push('uno');
        } else if (move.type === 'color') cues.push('color');
        else if (move.type === 'other') {
          if (move.draws.some(draw => draw.playerId !== move.playerId)) cues.push('catch');
          else if (move.draws.length) cues.push('penalty');
          else if (game.players.some(p => p.hasCalledUno && !confirmed?.players.find(old => old.id === p.id)?.hasCalledUno)) cues.push('uno');
          else cues.push('pass');
        } else if (move.type === 'draw') cues.push(move.draws.some(d => d.count > 1) ? 'penalty' : 'cardDraw');
      }
    }
    // Completion/turn cues wait for confirmation; rejected predictions never celebrate.
    if (isConfirmed) {
      if (game.status === 'round_over' && confirmed?.status !== 'round_over') cues.push('victory');
      else if ((game.finishOrder || []).some(id => !confirmed?.finishOrder?.includes(id) && game.players.find(p => p.id === id)?.cardCount === 0)) cues.push('finish');
      else if (!isDealing && game.status === 'playing' && game.players[game.turnIndex]?.id === myId && (dealing || confirmed?.players[confirmed.turnIndex]?.id !== myId)) cues.push('turn');
      confirmed = game;
    }
    dealing = isDealing;
    return cues;
  };
}
