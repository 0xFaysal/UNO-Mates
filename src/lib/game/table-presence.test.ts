import {describe,it,expect} from 'vitest';
import {startNewGame} from './engine';
import {automaticTurn,resolveTablePresence,EMPTY_TABLE_GRACE_MS} from './automation';

const now=1_000_000;
function table(){const state=startNewGame('presence',[{id:'a',name:'Alice',avatarColor:'#ef4444',isHost:true},{id:'b',name:'Bob',avatarColor:'#3b82f6',isHost:false},{id:'bot',name:'Panda Bot',avatarColor:'#10b981',isHost:false,isComputer:true}]);state.gameState={...state.gameState,openingDealPending:false,turnIndex:0,turnStartedAt:now-20000,turnDeadlineAt:now,automationAt:undefined,pendingAction:{type:'none',playerId:''},botCatchAt:now,botCatchTargetId:'a'};return state;}
describe('closing empty tables',()=>{
 it('keeps playing while any real member is present, including a finished spectator',()=>{
  const state=table();state.gameState.finishOrder=['b'];expect(resolveTablePresence(state,new Set(['b']),now)).toBeNull();
 });
 it('suspends an empty table before drawing, catching or playing a bot move',()=>{
  const state=table(),paused=resolveTablePresence(state,new Set(['bot','unknown']),now)!;
  expect(paused.gameState.emptySinceAt).toBe(now);expect(paused.gameState.automationAt).toBe(now+EMPTY_TABLE_GRACE_MS);expect(paused.gameState.botCatchAt).toBeUndefined();
  expect(paused.playerHands).toEqual(state.playerHands);expect(paused.drawPile).toEqual(state.drawPile);expect(paused.gameState.turnIndex).toBe(0);
  expect(state.gameState.emptySinceAt).toBeUndefined();expect(resolveTablePresence(paused,new Set(),now+1000)).toBe(paused);
 });
 it('ends the match after a second confirmed empty check and removes every scheduled action',()=>{
  const state=table(),paused=resolveTablePresence(state,new Set(),now)!;
  const closed=resolveTablePresence(paused,new Set(),now+EMPTY_TABLE_GRACE_MS)!;
  expect(closed.gameState.status).toBe('game_over');expect(closed.gameState.endReason).toBe('all_offline');expect(closed.gameState.version).toBe(state.gameState.version+2);
  for(const field of ['turnDeadlineAt','turnStartedAt','automationAt','botCatchAt','botCatchTargetId','emptySinceAt'] as const)expect(closed.gameState[field]).toBeUndefined();
  expect(closed.playerHands).toEqual(state.playerHands);expect(closed.drawPile).toEqual(state.drawPile);expect(closed.gameState.finishOrder).toEqual(state.gameState.finishOrder);
  expect(automaticTurn(closed,new Set(),now+60000)).toBeNull();expect(resolveTablePresence(closed,new Set(['a']),now+60000)).toBeNull();
 });
 it('lets a quick reconnect cancel closing without extending the original turn deadline',()=>{
  const state=table(),paused=resolveTablePresence(state,new Set(),now)!;
  const resumed=resolveTablePresence(paused,new Set(['a']),now+5000)!;
  expect(resumed.gameState.emptySinceAt).toBeUndefined();expect(resumed.gameState.turnDeadlineAt).toBe(state.gameState.turnDeadlineAt);expect(resumed.gameState.automationAt).toBeUndefined();expect(resumed.playerHands).toEqual(state.playerHands);
  const pausedAgain=resolveTablePresence(resumed,new Set(),now+6000)!;expect(pausedAgain.gameState.emptySinceAt).toBe(now+6000);
 });
 it('restores a computer turn only while a human is actually watching',()=>{
  const state=table();state.gameState.turnIndex=2;state.gameState.turnDeadlineAt=now+20000;
  const paused=resolveTablePresence(state,new Set(),now)!,resumed=resolveTablePresence(paused,new Set(['a']),now+5000)!;
  expect(resumed.gameState.automationAt).toBe(now+6200);expect(resumed.gameState.turnDeadlineAt).toBe(now+20000);
 });
});
