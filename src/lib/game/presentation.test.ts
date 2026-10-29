import { describe, it, expect } from 'vitest';
import { startNewGame, playCardAction, chooseColorAction } from './engine';
import { predictPlay, predictDraw, publicView, recordMove, predictPublicAction } from './presentation';
import type { Card, GameSnapshot } from './types';
const card=(id:string,color:Card['color'],value:Card['value']):Card=>({id,color,value,assetFile:color+'_'+value+'.svg'});
function snapshot():GameSnapshot {
 const state=startNewGame('presentation',[{id:'a',name:'Alice',avatarColor:'#ef4444',isHost:true},{id:'b',name:'Bob',avatarColor:'#3b82f6',isHost:false}]);
 const game=state.gameState;game.turnIndex=0;game.turnDirection=1;game.pendingAction={type:'none',playerId:''};game.drawPenalty=undefined;game.activeColor='red';game.topDiscard=card('top','red','5');game.discardPile=[game.topDiscard];game.drawnCardPlayableId=null;game.recentPlays=[{card:game.topDiscard,playerId:null,name:'Opening card'}];
 return {publicState:game,myHand:[card('r','red','8'),card('b','blue','2'),card('w','wild','draw4')],myPlayerId:'a'};
}
describe('Immediate local move previews',()=>{
 it('previews a legal card without mutating the confirmed snapshot',()=>{
  const base=snapshot();const before=JSON.stringify(base);const next=predictPlay(base,'a','r',false,'request-a');
  expect(next.myHand.map(c=>c.id)).toEqual(['b','w']);expect(next.publicState.topDiscard.id).toBe('r');expect(next.publicState.lastMove?.id).toBe('request-a');expect(JSON.stringify(base)).toBe(before);
 });
 it('combines a wild card and color in the same predicted move',()=>{
  const base=snapshot();const next=predictPlay(base,'a','w',true,'wild-request','green');
  const server=chooseColorAction(playCardAction({gameState:structuredClone(base.publicState),playerHands:{a:base.myHand},drawPile:[]},'a','w',true),'a','green');
  expect(next.publicState.pendingAction.type).toBe('none');expect(next.publicState.activeColor).toBe('green');expect(next.publicState.version).toBe(server.gameState.version);expect(next.publicState.drawPenalty?.amount).toBe(4);
 });
 it('never invents or exposes a drawn card',()=>{
  const base=snapshot();const next=predictDraw(base,'a','draw-request');expect(next.snapshot.myHand).toBe(base.myHand);expect(next.count).toBe(1);expect(next.snapshot.publicState.lastMove?.draws).toEqual([{playerId:'a',count:1}]);
 });
 it('keeps only the previous two plays plus the top card in view',()=>{
  const base=snapshot();base.publicState.discardPile=Array.from({length:20},(_,i)=>card('card'+i,'red','1'));base.publicState.drawnCardPlayableId='private-card';
  expect(publicView(base.publicState,'b').discardPile).toHaveLength(3);expect(publicView(base.publicState,'b').drawnCardPlayableId).toBeNull();expect(base.publicState.discardPile).toHaveLength(20);
 });
 it('records the actor and caps history at three cards',()=>{
  const base=snapshot();let game=base.publicState;
  for(let i=0;i<5;i++)game=recordMove(game,{...game,topDiscard:card('c'+i,'red','1')},'a','play','req'+i);
  expect(game.recentPlays).toHaveLength(3);expect(game.recentPlays?.[0].name).toBe('Alice');expect(game.lastMove?.playerId).toBe('a');
 });
 it('rejects an illegal preview without changing the hand',()=>{
  const base=snapshot();expect(()=>predictPlay(base,'a','b',false,'bad')).toThrow();expect(base.myHand).toHaveLength(3);
 });
 it('immediately previews an opening wild color selection',()=>{
  const base=snapshot();base.publicState.pendingAction={type:'choose_color_wild',playerId:'a',openingWild:true};const next=predictPublicAction(base,'a','choose_color','color','blue');expect(next.publicState.activeColor).toBe('blue');expect(next.publicState.turnIndex).toBe(0);
 });
});
