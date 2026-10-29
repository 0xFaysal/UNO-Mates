import { describe,it,expect } from 'vitest';
import { startNewGame } from './engine';
import { rankedPlayers,resultShareText } from './results';
import { acceptsSnapshot } from './presentation';
const table=()=>startNewGame('test',Array.from({length:3},(_,i)=>({id:'p'+i,name:['Tea Ninja','আমের রাজা','Last Mate'][i],avatarColor:'#ef4444',isHost:i===0}))).gameState;
describe('Shareable results',()=>{
 it('accepts a fresh round after returning to the lobby without accepting delayed old results',()=>{
  const old={...table(),roundId:'old',roundStartedAt:100,version:90};
  const next={...table(),roundId:'next',roundStartedAt:200,version:1};
  expect(acceptsSnapshot(old,next)).toBe(true);expect(acceptsSnapshot(next,old)).toBe(false);
  expect(acceptsSnapshot(next,{...next,version:0})).toBe(false);
 });
 it('keeps the authoritative order and excludes missing or duplicated identities',()=>{
  const game=table();game.finishOrder=['p1','missing','p0','p1','p2'];
  expect(rankedPlayers(game).map(p=>p.id)).toEqual(['p1','p0','p2']);
  expect(resultShareText(game,'p0')).toContain('I placed #2 of 3');
  expect(resultShareText(game,'p0')).toContain('আমের রাজা won');
  expect(resultShareText(game,'p0')).not.toContain('test');
 });
 it('supports legacy winner-only results without inventing ranks',()=>{
  const game=table();delete game.finishOrder;game.winnerPlayerId='p2';
  expect(rankedPlayers(game).map(p=>p.id)).toEqual(['p2']);
  expect(resultShareText(game,'p0')).not.toContain('I placed');
 });
});
