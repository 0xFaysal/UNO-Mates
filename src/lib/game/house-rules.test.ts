import { describe, expect, it } from 'vitest';
import { canPlayCard, chooseColorAction, drawCardAction, playCardAction, startNewGame } from './engine';
import type { Card, CardColor, CardValue } from './types';
const card=(id:string,color:CardColor,value:CardValue):Card=>({id,color,value,assetFile:''});
function setup(){
 const s=startNewGame('house',[{id:'a',name:'A',avatarColor:'red',isHost:true},{id:'b',name:'B',avatarColor:'blue',isHost:false},{id:'c',name:'C',avatarColor:'green',isHost:false}],()=>0.5);
 s.gameState.turnIndex=0;s.gameState.turnDirection=1;s.gameState.activeColor='red';s.gameState.topDiscard=card('top','red','5');s.gameState.discardPile=[s.gameState.topDiscard];s.gameState.pendingAction={type:'none',playerId:''};s.gameState.drawnCardPlayableId=null;s.gameState.drawPenalty=undefined;
 s.playerHands={a:[card('a2','red','draw2'),card('a4','wild','draw4'),card('an','red','1')],b:[card('b2','blue','draw2'),card('b4','wild','draw4'),card('bn','blue','1')],c:[card('c4','wild','draw4'),card('cn','green','1')]};
 s.gameState.players.forEach(p=>p.cardCount=s.playerHands[p.id].length);s.drawPile=Array.from({length:30},(_,i)=>card('d'+i,'blue','9'));return s;
}
describe('Custom stacking and number-only finish',()=>{
 it('accumulates +2, different-color +2, +4 and +4 into 12',()=>{let s=playCardAction(setup(),'a','a2');s=playCardAction(s,'b','b2');s=chooseColorAction(playCardAction(s,'c','c4'),'c','red');s=chooseColorAction(playCardAction(s,'a','a4'),'a','blue');expect(s.gameState.drawPenalty).toEqual({amount:12,value:'draw4'});const before=JSON.stringify(s);const next=drawCardAction(s,'b');expect(next.playerHands.b).toHaveLength(14);expect(next.gameState.turnIndex).toBe(2);expect(next.gameState.drawPenalty).toBeUndefined();expect(JSON.stringify(s)).toBe(before);});
 it.each(['draw2','skip','reverse','wild','5'] as CardValue[])('rejects %s on a pending +4',value=>{let s=chooseColorAction(playCardAction(setup(),'a','a4'),'a','blue');s.playerHands.b=[card('illegal',value==='wild'?'wild':'blue',value),card('keep','blue','1')];expect(()=>playCardAction(s,'b','illegal')).toThrow();});
 it.each(['skip','reverse','wild','draw2','draw4'] as CardValue[])('cannot finish with %s',value=>{const s=setup();s.playerHands.a=[card('last',value==='wild'||value==='draw4'?'wild':'red',value)];s.gameState.players[0].cardCount=1;expect(canPlayCard(s.playerHands.a[0],s.gameState,1)).toBe(false);expect(()=>playCardAction(s,'a','last')).toThrow();});
 it('wins immediately with a matching last number and no points',()=>{const s=setup();s.playerHands.a=[card('last','red','1')];s.gameState.players[0].cardCount=1;const next=playCardAction(s,'a','last');expect(next.gameState.status).toBe('round_over');expect(next.gameState.winnerPlayerId).toBe('a');expect(next.gameState.players.every(p=>p.score===0)).toBe(true);expect(()=>drawCardAction(next,'a')).toThrow();});
 it('can draw instead when left with only a power card',()=>{const s=setup();s.playerHands.a=[card('last','wild','draw4')];const next=drawCardAction(s,'a');expect(next.playerHands.a).toHaveLength(2);expect(next.gameState.drawnCardPlayableId).toBeNull();expect(next.gameState.turnIndex).toBe(1);});
 it('resumes normal matching after accepting penalty',()=>{let s=playCardAction(setup(),'a','a2');s=drawCardAction(s,'b');expect(canPlayCard(card('red','red','3'),s.gameState,2)).toBe(true);expect(canPlayCard(card('blue','blue','3'),s.gameState,2)).toBe(false);});
 it('prevents playing until the stacker chooses a color',()=>{const s=playCardAction(setup(),'a','a4');expect(()=>playCardAction(s,'b','b4')).toThrow();expect(()=>drawCardAction(s,'a')).toThrow();});
});
