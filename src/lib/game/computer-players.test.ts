import {describe,it,expect} from 'vitest';
import {createClassicDeck} from './deck';
import {startNewGame,playCardAction,callUnoAction,drawCardAction} from './engine';
import {automaticTurn,botCard} from './automation';
import {freshTurn,openingTurn} from './turn-clock';
import {recordMove} from './presentation';
const now=1000000,deck=createClassicDeck(),pick=(id:string)=>deck.find(c=>c.id===id)!;
function fixture(){
 const state=startNewGame('bots',[{id:'a',name:'Human',avatarColor:'#ef4444',isHost:true},{id:'b',name:'Other human',avatarColor:'#3b82f6',isHost:false},{id:'c',name:'Panda Bot',avatarColor:'#8b5cf6',isHost:false,isComputer:true}]);
 const hands={a:[pick('red_1_0'),pick('blue_2_0')],b:[pick('red_3_0'),pick('green_4_0')],c:[pick('red_skip_0'),pick('red_5_0')]};const top=pick('red_0_0'),used=new Set([top.id,...Object.values(hands).flat().map(c=>c.id)]);
 state.playerHands=hands;state.drawPile=deck.filter(c=>!used.has(c.id));state.gameState=freshTurn({...state.gameState,players:state.gameState.players.map(p=>({...p,cardCount:2})),turnIndex:0,turnDirection:1,topDiscard:top,discardPile:[top],activeColor:'red',pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawPileCount:state.drawPile.length},now);
 return state;
}
describe('human-like computer seats',()=>{
 it('attacks a near winner and preserves a number for its final card',()=>{
  const state=fixture();state.gameState.turnIndex=2;state.gameState.players[0].cardCount=1;
  expect(botCard(state.gameState,state.playerHands.c)?.value).toBe('skip');
 });
 it('keeps a useful wild when an ordinary matching card works',()=>{
  const state=fixture();state.gameState.turnIndex=2;state.gameState.players[0].cardCount=7;
  const hand=[pick('wild_wild_0'),pick('red_1_0'),pick('blue_2_0'),pick('green_3_0'),pick('yellow_4_0')];
  expect(botCard(state.gameState,hand)?.color).toBe('red');
 });
 it('plays independently, says UNO and never becomes a human presence',()=>{
  const state=fixture();state.gameState=freshTurn({...state.gameState,turnIndex:2},now);
  const next=automaticTurn(state,new Set(['a','b','c']),state.gameState.automationAt!)!;
  expect(next.gameState.players[2]).toMatchObject({isComputer:true,isBot:true,hasCalledUno:true,cardCount:1,isOnline:false});
  expect(next.gameState.unoChallengeablePlayerId).toBeNull();
 });
 it('waits for the shared deal boundary when a computer has the opening turn',()=>{
  const state=fixture();state.gameState=openingTurn({...state.gameState,turnIndex:2},now);
  expect(state.gameState.automationAt).toBe(state.gameState.openingNotBeforeAt);
  expect(automaticTurn(state,new Set(['a']),state.gameState.openingNotBeforeAt!-1)).toBeNull();
  const ready=automaticTurn(state,new Set(['a']),state.gameState.openingNotBeforeAt!)!;
  expect(ready.gameState.openingDealPending).toBeUndefined();expect(ready.gameState.automationAt).toBe(state.gameState.openingNotBeforeAt!+1200);
 });
 it('catches missed UNO off-turn without extending the human turn',()=>{
  const before=fixture();const state=playCardAction(before,'a',before.playerHands.a[0].id,false);
  state.gameState=recordMove(before.gameState,state.gameState,'a','play','missed',now);
  expect(state.gameState.turnIndex).toBe(1);expect(state.gameState.botCatchTargetId).toBe('a');
  expect(automaticTurn(state,new Set(['a','b']),now+899)).toBeNull();
  const next=automaticTurn(state,new Set(['a','b']),now+900)!;
  expect(next.playerHands.a).toHaveLength(3);expect(next.gameState.lastMove?.playerId).toBe('c');expect(next.gameState.lastMove?.draws).toContainEqual({playerId:'a',count:2});
  expect(next.gameState.turnIndex).toBe(1);expect(next.gameState.turnDeadlineAt).toBe(state.gameState.turnDeadlineAt);expect(next.gameState.botCatchAt).toBeUndefined();
 });
 it('does not catch after UNO is declared or after the next action closes the window',()=>{
  const before=fixture();const state=playCardAction(before,'a',before.playerHands.a[0].id,false);state.gameState=recordMove(before.gameState,state.gameState,'a','play','missed',now);
  const declared=callUnoAction(state,'a');declared.gameState=recordMove(state.gameState,declared.gameState,'a','other','declared',now+400);
  expect(declared.gameState.botCatchAt).toBeUndefined();expect(automaticTurn(declared,new Set(['a','b']),now+900)).toBeNull();
  const drawn=drawCardAction(state,'b');drawn.gameState=recordMove(state.gameState,drawn.gameState,'b','draw','closed',now+400);expect(drawn.gameState.botCatchAt).toBeUndefined();
 });
 it('cannot finish on a power card',()=>{const state=fixture();state.gameState.turnIndex=2;expect(botCard(state.gameState,[pick('red_skip_0')])).toBeUndefined();});
 it('catches before taking its own next turn, instead of closing the catch window by playing',()=>{
  const before=fixture();before.gameState.turnDirection=-1;
  const state=playCardAction(before,'a',before.playerHands.a[0].id,false);state.gameState=recordMove(before.gameState,state.gameState,'a','play','missed',now);
  expect(state.gameState.turnIndex).toBe(2);
  const next=automaticTurn(state,new Set(['a','b']),now+1200)!;
  expect(next.gameState.lastMove?.type).toBe('other');expect(next.playerHands.a).toHaveLength(3);expect(next.playerHands.c).toHaveLength(2);
 });
 it('plays +4 legally, picks its remaining color and declares UNO in the same move',()=>{
  const state=fixture();state.playerHands.c=[pick('wild_draw4_0'),pick('red_5_0')];
  state.gameState=freshTurn({...state.gameState,turnIndex:2,activeColor:'blue',topDiscard:pick('blue_0_0')},now);
  const next=automaticTurn(state,new Set(['a','b']),now+1200)!;
  expect(next.gameState.drawPenalty).toEqual({amount:4,value:'draw4'});expect(next.gameState.pendingAction.type).toBe('none');expect(next.gameState.activeColor).toBe('red');expect(next.gameState.players[2].hasCalledUno).toBe(true);
 });

});
