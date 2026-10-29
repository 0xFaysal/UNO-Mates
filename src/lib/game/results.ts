import type { GameState, PlayerPublic } from './types';
export type ResultGame = Pick<GameState, 'players' | 'finishOrder' | 'winnerPlayerId'>;
export function rankedPlayers(game: ResultGame): PlayerPublic[] {
  const order = game.finishOrder?.length ? game.finishOrder : game.winnerPlayerId ? [game.winnerPlayerId] : [];
  return [...new Set(order)].flatMap(id => { const player = game.players.find(player => player.id === id); return player ? [player] : []; });
}
export function resultShareText(game: GameState, myPlayerId: string): string {
  const ranked = rankedPlayers(game), place = ranked.findIndex(player => player.id === myPlayerId) + 1;
  return `${ranked[0]?.name || 'Our table'} won at UNO Mates!${place ? ` I placed #${place} of ${game.players.length}.` : ''} Your mates. Your table. Your next win.`;
}
