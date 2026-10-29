import type { GameState, GameSnapshot, ServerAuthoritativeState, TableMove } from './types';
import { playCardAction, chooseColorAction, passTurnAction, callUnoAction } from './engine';
export function publicView(game: GameState, playerId: string): GameState {
 return { ...game, discardPile: game.discardPile.slice(-3), drawnCardPlayableId: game.players[game.turnIndex]?.id === playerId ? game.drawnCardPlayableId : null };
}
export function recordMove(before: GameState, after: GameState, playerId: string, type: TableMove['type'], id: string): GameState {
 const draws = after.players.flatMap(p => { const count = p.cardCount - (before.players.find(b => b.id === p.id)?.cardCount || 0); return count > 0 && type !== 'start' ? [{ playerId: p.id, count }] : []; });
 const recentPlays = type === 'play' ? [{ card: after.topDiscard, playerId, name: after.players.find(p => p.id === playerId)?.name || 'Player' }, ...(before.recentPlays || before.discardPile.slice(-2).reverse().map(card => ({ card, playerId: null, name: 'Previous play' })))].slice(0,3) : after.recentPlays;
 return { ...after, recentPlays, lastMove: { id, type, playerId, ...(type === 'play' ? { card: after.topDiscard } : {}), draws } };
}
// Only plays are predictable. Hidden draw cards are never guessed or manufactured.
export function predictPlay(snapshot: GameSnapshot, playerId: string, cardId: string, uno: boolean, requestId: string, color?: 'red'|'yellow'|'green'|'blue'): GameSnapshot {
 const before = snapshot.publicState;
 let state: ServerAuthoritativeState = { gameState: structuredClone(before), playerHands: { [playerId]: [...snapshot.myHand] }, drawPile: [] };
 state = playCardAction(state, playerId, cardId, uno);
 if (color && ['choose_color_wild','choose_color_draw4'].includes(state.gameState.pendingAction.type)) state = chooseColorAction(state, playerId, color);
 return { ...snapshot, publicState: recordMove(before,state.gameState,playerId,'play',requestId), myHand: state.playerHands[playerId] };
}
export function predictDraw(snapshot: GameSnapshot, playerId: string, requestId: string): { snapshot: GameSnapshot; count: number } {
 const count = snapshot.publicState.drawPenalty?.amount || 1;
 return { count, snapshot: { ...snapshot, publicState: { ...snapshot.publicState, lastMove: { id: requestId, type: 'draw', playerId, draws: [{ playerId, count }] } } } };
}

export function predictPublicAction(snapshot: GameSnapshot, playerId: string, action: string, requestId: string, color?: 'red'|'yellow'|'green'|'blue'): GameSnapshot {
 const state: ServerAuthoritativeState = { gameState: structuredClone(snapshot.publicState), playerHands: { [playerId]: [...snapshot.myHand] }, drawPile: [] };
 const next = action === 'choose_color' && color ? chooseColorAction(state,playerId,color) : action === 'pass_turn' ? passTurnAction(state,playerId) : callUnoAction(state,playerId);
 return { ...snapshot, publicState: recordMove(snapshot.publicState,next.gameState,playerId,action === 'choose_color' ? 'color' : 'other',requestId) };
}
