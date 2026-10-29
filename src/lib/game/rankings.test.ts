import { describe, it, expect } from 'vitest';
import { startNewGame, playCardAction, getNextActiveTurnIndex, drawCardAction, passTurnAction, chooseColorAction, callUnoAction, catchUnoAction } from './engine';
import type { Card, CardValue, ServerAuthoritativeState } from './types';
import { predictPlay } from './presentation';

const card = (id: string, value: CardValue = '7', color: Card['color'] = 'red'): Card => ({ id, value, color, assetFile: color + '_' + value + '.svg' });
function table(count = 4): ServerAuthoritativeState {
  const state = startNewGame('rank-test', Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'Player ' + i, avatarColor: '#ef4444', isHost: i === 0 })));
  state.gameState = { ...state.gameState, activeColor: 'red', topDiscard: card('top'), discardPile: [card('top')], pendingAction: { type: 'none', playerId: '' }, drawPenalty: undefined, turnIndex: 0, turnDirection: 1 };
  state.gameState.players = state.gameState.players.map(p => ({ ...p, cardCount: 1 }));
  state.playerHands = Object.fromEntries(state.gameState.players.map(p => [p.id, [card(p.id + '-last')]]));
  state.drawPile = [card('draw', '1', 'blue')];
  state.gameState.drawPileCount = 1;
  return state;
}
function retired(state: ServerAuthoritativeState, ids: string[]) {
  state.gameState.finishOrder = ids;
  state.gameState.winnerPlayerId = ids[0] || null;
  for (const id of ids) { state.playerHands[id] = []; state.gameState.players.find(p => p.id === id)!.cardCount = 0; }
  return state;
}
function give(state: ServerAuthoritativeState, id: string, cards: Card[]) {
  state.playerHands[id] = cards; state.gameState.players.find(p => p.id === id)!.cardCount = cards.length;
}

describe('Finish rankings and continued play', () => {
  it('continues after each finish and assigns the remaining player last place', () => {
    const initial = table();
    const first = playCardAction(initial, 'p0', 'p0-last');
    expect(first.gameState.status).toBe('playing'); expect(first.gameState.finishOrder).toEqual(['p0']);
    expect(first.gameState.activeColor).toBe('red'); expect(first.gameState.turnIndex).toBe(1);
    const second = playCardAction(first, 'p1', 'p1-last');
    expect(second.gameState.status).toBe('playing'); expect(second.gameState.finishOrder).toEqual(['p0','p1']);
    const final = playCardAction(second, 'p2', 'p2-last');
    expect(final.gameState.status).toBe('round_over'); expect(final.gameState.finishOrder).toEqual(['p0','p1','p2','p3']);
    expect(final.gameState.winnerPlayerId).toBe('p0'); expect(final.playerHands.p3).toHaveLength(1);
    expect(initial.gameState.finishOrder).toEqual([]);
  });
  it('keeps two-player rounds working and clears ranks on restart', () => {
    const final = playCardAction(table(2),'p0','p0-last');
    expect(final.gameState.finishOrder).toEqual(['p0','p1']); expect(final.gameState.status).toBe('round_over');
    const restart = startNewGame('rank-test',final.gameState.players);
    expect(restart.gameState.finishOrder).toEqual([]); expect(restart.gameState.winnerPlayerId).toBeNull();
  });
  it('advances past finished seats in both directions, including skips', () => {
    const state = retired(table(6),['p1','p3','p5']);
    expect(getNextActiveTurnIndex(state.gameState,0,1)).toBe(2);
    expect(getNextActiveTurnIndex(state.gameState,0,-1)).toBe(4);
    expect(getNextActiveTurnIndex(state.gameState,0,1,1)).toBe(4);
    state.gameState.turnDirection = -1;
    const next = playCardAction(state,'p0','p0-last');
    expect(next.gameState.turnIndex).toBe(4); expect(next.gameState.status).toBe('playing');
  });
  it('Skip and Reverse use the two remaining active players', () => {
    for (const value of ['skip','reverse'] as const) {
      const state = retired(table(),['p1','p3']); give(state,'p0',[card('action',value),card('spare')]);
      const next=playCardAction(state,'p0','action'); expect(next.gameState.turnIndex).toBe(0);
    }
  });
  it('penalties, ordinary draws and passing skip all finishers', () => {
    const state=retired(table(),['p1']); state.gameState.drawPenalty={amount:2,value:'draw2'};
    expect(drawCardAction(state,'p0').gameState.turnIndex).toBe(2);
    state.gameState.drawPenalty=undefined;
    expect(drawCardAction(state,'p0').gameState.turnIndex).toBe(2);
    state.gameState.drawnCardPlayableId='p0-last';
    expect(passTurnAction(state,'p0').gameState.turnIndex).toBe(2);
  });
  it('Wild and +4 color choices target the next active seat', () => {
    for (const value of ['wild','draw4'] as const) {
      const state=retired(table(),['p1']);give(state,'p0',[card('wild',value,'wild'),card('spare')]);
      const played=playCardAction(state,'p0','wild');
      if(value==='draw4')expect(played.gameState.pendingAction.targetPlayerId).toBe('p2');
      expect(chooseColorAction(played,'p0','blue').gameState.turnIndex).toBe(2);
    }
  });
  it('finished players cannot rejoin turns or affect UNO catches', () => {
    const state=retired(table(),['p1']);state.gameState.unoChallengeablePlayerId='p0';
    expect(()=>playCardAction(state,'p1','p1-last')).toThrow();expect(()=>drawCardAction(state,'p1')).toThrow();
    expect(()=>callUnoAction(state,'p1')).toThrow(); expect(()=>catchUnoAction(state,'p1','p0')).toThrow();
  });
  it('predicts the same finishing order as the server without exposing hands', () => {
    const state=table(3); const preview=predictPlay({publicState:state.gameState,myHand:state.playerHands.p0},'p0','p0-last',false,'move');
    const confirmed=playCardAction(state,'p0','p0-last');
    expect(preview.publicState.finishOrder).toEqual(confirmed.gameState.finishOrder);expect(preview.publicState.status).toBe('playing');
    expect(preview.publicState.turnIndex).toBe(1);expect(preview.myHand).toEqual([]);
  });
});
