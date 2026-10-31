import {describe,it,expect} from 'vitest';
import {createClassicDeck} from './deck';
import {startNewGame,drawCardAction,playCardAction} from './engine';
import {automaticTurn,botCard,botColor} from './automation';
import {clockAfterMove,freshTurn,openingTurn,confirmOpeningReady,TURN_MS,openingDealMs} from './turn-clock';
import {recordMove} from './presentation';
import {ruleHint} from './rule-hint';
import {acceptReaction} from './reactions';
import type {Card,ServerAuthoritativeState} from './types';
const now=1_000_000;
const card=(id:string)=>createClassicDeck().find(c=>c.id===id)!;
function fixture():ServerAuthoritativeState{
  const state=startNewGame('clock',[{id:'a',name:'Alice',avatarColor:'#ef4444',isHost:true},{id:'b',name:'Bob',avatarColor:'#3b82f6',isHost:false},{id:'c',name:'Charlie',avatarColor:'#10b981',isHost:false}]);
  const hands={a:[card('red_1_0'),card('blue_2_0')],b:[card('red_2_0'),card('blue_3_0')],c:[card('green_1_0'),card('yellow_2_0')]};
  const top=card('red_0_0'),used=new Set([top.id,...Object.values(hands).flat().map(c=>c.id)]);
  state.drawPile=createClassicDeck().filter(c=>!used.has(c.id));state.playerHands=hands;
  state.gameState={...state.gameState,openingDealPending:false,openingNotBeforeAt:undefined,turnIndex:0,turnDirection:1,pendingAction:{type:'none',playerId:''},topDiscard:top,discardPile:[top],activeColor:'red',drawPenalty:undefined,drawnCardPlayableId:null,players:state.gameState.players.map(p=>({...p,cardCount:2,isOnline:true})),turnStartedAt:now,turnDeadlineAt:now+TURN_MS,turnToken:'turn-a',automationAt:undefined};
  return state;
}
describe('twenty-second server turns',()=>{
  it('keeps opening time separate and gives the first player a full 20s after a delayed deal',()=>{
    const game=openingTurn(fixture().gameState,now);
    expect(game.turnStartedAt).toBeUndefined();expect(game.openingDealPending).toBe(true);
    const readyAt=now+openingDealMs(game.players.length)+7000;
    const ready=confirmOpeningReady(game,'a',game.roundId!,game.turnToken!,readyAt);
    expect(ready.turnStartedAt).toBe(readyAt);expect(ready.turnDeadlineAt).toBe(readyAt+TURN_MS);expect(ready.openingDealPending).toBeUndefined();
    expect(confirmOpeningReady(ready,'a',game.roundId!,game.turnToken!,readyAt+5000)).toBe(ready);
  });
  it('does not start an early reduced-motion acknowledgement before the opening boundary',()=>{
    const game=openingTurn(fixture().gameState,now);
    const ready=confirmOpeningReady(game,'a',game.roundId!,game.turnToken!,now+100);
    expect(ready.turnStartedAt).toBe(game.openingNotBeforeAt);expect(ready.turnDeadlineAt!-ready.turnStartedAt!).toBe(TURN_MS);
  });
  it('rejects another player and stale-round opening acknowledgements',()=>{
    const game=openingTurn(fixture().gameState,now);
    expect(()=>confirmOpeningReady(game,'b',game.roundId!,game.turnToken!,now)).toThrow('Only the first');
    expect(()=>confirmOpeningReady(game,'a','old-round',game.turnToken!,now)).toThrow('round changed');
    expect(()=>confirmOpeningReady(game,'a',game.roundId!,'old-turn',now)).toThrow('turn changed');
  });
  it('starts a bounded fallback turn when no first-player browser acknowledges',()=>{
    const state=fixture();state.gameState=openingTurn(state.gameState,now);
    expect(automaticTurn(state,new Set(),state.gameState.turnDeadlineAt!-1)).toBeNull();
    const fallbackAt=state.gameState.turnDeadlineAt!;
    const ready=automaticTurn(state,new Set(),fallbackAt)!;
    expect(ready.gameState.turnIndex).toBe(0);expect(ready.gameState.players[0].offlineMisses||0).toBe(0);
    expect(ready.gameState.turnDeadlineAt).toBe(fallbackAt+TURN_MS);
    expect(automaticTurn(ready,new Set(),fallbackAt+TURN_MS)!.gameState.turnIndex).toBe(1);
  });
  it('lets a connected slow phone finish dealing, with a fixed opening limit',()=>{
    const state=fixture();state.gameState=openingTurn(state.gameState,now);
    const extended=automaticTurn(state,new Set(['a']),state.gameState.turnDeadlineAt!)!;
    expect(extended.gameState.openingDealPending).toBe(true);expect(extended.gameState.turnStartedAt).toBeUndefined();
    expect(extended.gameState.turnDeadlineAt).toBe(state.gameState.openingHardDeadlineAt);
    const ready=automaticTurn(extended,new Set(['a']),extended.gameState.turnDeadlineAt!)!;
    expect(ready.gameState.openingDealPending).toBeUndefined();expect(ready.gameState.turnDeadlineAt!-ready.gameState.turnStartedAt!).toBe(TURN_MS);
  });
  it('a first direct action also ends opening readiness without extending later moves',()=>{
    const game=openingTurn(fixture().gameState,now);
    const drawn=clockAfterMove(game,{...game,drawnCardPlayableId:'drawn'},'draw','request',now+3000);
    expect(drawn.openingDealPending).toBeUndefined();expect(drawn.turnDeadlineAt).toBe(now+23000);
    expect(clockAfterMove(drawn,drawn,'other','uno',now+4000).turnDeadlineAt).toBe(now+23000);
  });
  it('cannot expire early and a normal timeout draws exactly one card then passes',()=>{
    const state=fixture();expect(automaticTurn(state,new Set(['a']),now+19999)).toBeNull();
    const result=automaticTurn(state,new Set(['a']),now+20000)!;
    expect(result.gameState.turnIndex).toBe(1);expect(result.playerHands.a).toHaveLength(3);
    expect(result.gameState.lastMove?.draws).toEqual([{playerId:'a',count:1}]);expect(result.gameState.players[0].cardCount).toBe(3);
    expect(result.gameState.turnDeadlineAt).toBe(now+40000);expect(result.gameState.lastMove?.type).toBe('timeout');
    expect(state.gameState.turnIndex).toBe(0);expect(state.playerHands.a).toHaveLength(2);
  });
  it('takes the entire stacked penalty on timeout even if the player is offline',()=>{
    const state=fixture();state.gameState.drawPenalty={amount:10,value:'draw4'};
    const result=automaticTurn(state,new Set(),now+20000)!;
    expect(result.playerHands.a).toHaveLength(12);expect(result.gameState.turnIndex).toBe(1);
    expect(result.gameState.drawPenalty).toBeUndefined();expect(result.gameState.lastMove?.draws).toEqual([{playerId:'a',count:10}]);
  });
  it('adds the missed-turn card even after drawing a playable card',()=>{
    const state=fixture();state.gameState.drawnCardPlayableId=state.playerHands.a[0].id;
    const result=automaticTurn(state,new Set(),now+20000)!;
    expect(result.playerHands.a).toHaveLength(3);expect(result.gameState.drawnCardPlayableId).toBeNull();expect(result.gameState.turnIndex).toBe(1);
    expect(result.gameState.lastMove?.draws).toEqual([{playerId:'a',count:1}]);
  });
  it('requires two consecutive offline misses, then plays future offline turns',()=>{
    let state=fixture();
    for(let miss=1;miss<=2;miss++){
      state.gameState=freshTurn({...state.gameState,turnIndex:0},now);
      state=automaticTurn(state,new Set(['b']),now+20000)!;
      expect(state.gameState.players[0].offlineMisses).toBe(miss);
      expect(state.gameState.players[0].isBot).toBe(miss===2);
    }
    state.gameState=freshTurn({...state.gameState,turnIndex:0},now+30000);
    expect(state.gameState.automationAt).toBe(now+31200);
    const played=automaticTurn(state,new Set(['b']),now+31200)!;
    expect(played.gameState.lastMove?.type).toBe('play');expect(played.playerHands.a).toHaveLength(3);
    expect(played.gameState.players[0].hasCalledUno).toBe(false);
  });
  it('an online missed turn resets the consecutive offline count',()=>{
    const state=fixture();state.gameState.players[0].offlineMisses=1;
    const result=automaticTurn(state,new Set(['a']),now+20000)!;
    expect(result.gameState.players[0].offlineMisses).toBe(0);expect(result.gameState.players[0].isBot).toBe(false);
  });
  it('gives control back on reconnect without playing a bot move or adding time',()=>{
    const state=fixture();state.gameState.players[0]={...state.gameState.players[0],isOnline:false,isBot:true,offlineMisses:2};state.gameState.automationAt=now+1200;
    const result=automaticTurn(state,new Set(['a']),now+1200)!;
    expect(result.gameState.players[0].isBot).toBe(false);expect(result.gameState.players[0].offlineMisses).toBe(0);
    expect(result.gameState.turnDeadlineAt).toBe(state.gameState.turnDeadlineAt);expect(result.gameState.automationAt).toBeUndefined();
    expect(result.playerHands.a).toEqual(state.playerHands.a);
  });
  it('automatically resolves an expired wild-color choice',()=>{
    const state=fixture();state.playerHands.a=[{id:'w',color:'wild',value:'wild',assetFile:'wild.svg'},card('blue_2_0')];
    const played=playCardAction(state,'a','w',true);
    played.gameState=recordMove(state.gameState,played.gameState,'a','play','wild',now+1000);
    const result=automaticTurn(played,new Set(),now+20000)!;
    expect(result.gameState.activeColor).toBe('blue');expect(result.gameState.pendingAction.type).toBe('none');expect(result.gameState.turnIndex).toBe(1);
    expect(result.playerHands.a).toHaveLength(2);expect(result.gameState.players[0].hasCalledUno).toBe(false);
    expect(result.gameState.lastMove?.draws).toEqual([{playerId:'a',count:1}]);
  });
  it('passes even when the timeout card would have been playable',()=>{
    const state=fixture();state.drawPile=[card('red_3_0')];state.gameState.drawPileCount=1;
    const result=automaticTurn(state,new Set(['a']),now+20000)!;
    expect(result.playerHands.a.at(-1)?.id).toBe('red_3_0');expect(result.gameState.turnIndex).toBe(1);expect(result.gameState.drawnCardPlayableId).toBeNull();
  });
  it('charges a missed Draw Four color choice to its owner and leaves the stack for the next player',()=>{
    const state=fixture();state.playerHands.a=[card('wild_draw4_0'),card('blue_2_0')];
    const played=playCardAction(state,'a','wild_draw4_0',true);
    played.gameState=recordMove(state.gameState,played.gameState,'a','play','draw-four',now+1000);
    const result=automaticTurn(played,new Set(),now+20000)!;
    expect(result.playerHands.a).toHaveLength(2);expect(result.playerHands.b).toHaveLength(2);
    expect(result.gameState.turnIndex).toBe(1);expect(result.gameState.drawPenalty).toEqual({amount:4,value:'draw4'});
    expect(result.gameState.lastMove?.draws).toEqual([{playerId:'a',count:1}]);
  });
  it('recycles old discards for a timeout and retains the top card',()=>{
    const state=fixture(),recycled=card('green_9_0');state.drawPile=[];state.gameState.drawPileCount=0;state.gameState.discardPile=[recycled,state.gameState.topDiscard];
    const result=automaticTurn(state,new Set(),now+20000)!;
    expect(result.playerHands.a.at(-1)?.id).toBe(recycled.id);expect(result.gameState.discardPile).toEqual([state.gameState.topDiscard]);expect(result.gameState.turnIndex).toBe(1);
  });
  it('does not get stuck or invent cards when the entire draw supply is exhausted',()=>{
    const state=fixture();state.drawPile=[];state.gameState.drawPileCount=0;
    const result=automaticTurn(state,new Set(),now+20000)!;
    expect(result.playerHands.a).toHaveLength(2);expect(result.gameState.turnIndex).toBe(1);expect(result.gameState.lastMove?.draws).toEqual([]);
  });
  it('does not reset the clock for UNO, Catch or a playable draw',()=>{
    const state=fixture();
    expect(clockAfterMove(state.gameState,{...state.gameState,version:2},'other','uno',now+10000).turnDeadlineAt).toBe(now+20000);
    state.drawPile=[card('red_3_0'),...state.drawPile.filter(c=>c.id!=='red_3_0')];
    const drawn=drawCardAction(state,'a');const result=recordMove(state.gameState,drawn.gameState,'a','draw','draw',now+10000);
    expect(result.drawnCardPlayableId).toBe('red_3_0');expect(result.turnDeadlineAt).toBe(now+20000);
  });
  it('a two-player Skip grants a fresh turn even when the same player acts again',()=>{
    const state=fixture();state.gameState.players=state.gameState.players.slice(0,2);
    const result=clockAfterMove(state.gameState,{...state.gameState,turnIndex:0},'play','skip',now+4000);
    expect(result.turnDeadlineAt).toBe(now+24000);
  });
  it('clears the clock once rankings are complete',()=>{
    const game=fixture().gameState;
    expect(clockAfterMove(game,{...game,status:'round_over'},'play','finish',now).turnDeadlineAt).toBeUndefined();
  });
});
describe('private-hand bot choices and timely rules',()=>{
  it('keeps a number for its finish and never finishes with a power card',()=>{
    const game=fixture().gameState,hand=[card('red_1_0'),card('red_skip_0')];
    expect(botCard(game,hand)?.value).toBe('skip');expect(botCard(game,[card('red_skip_0')])).toBeUndefined();
    expect(ruleHint(game,hand,hand[0].id)).toBe('Keep a number for your final card.');
  });
  it('respects a +4 stack and drawn-card-only restriction',()=>{
    const game=fixture().gameState;game.drawPenalty={amount:8,value:'draw4'};
    const four:Card={id:'four',color:'wild',value:'draw4',assetFile:'wild_draw4.svg'};
    expect(botCard(game,[card('red_draw2_0'),four])?.id).toBe('four');
    game.drawPenalty=undefined;game.drawnCardPlayableId='only';expect(botCard(game,[card('red_1_0')])).toBeUndefined();
  });
  it('chooses a color from its own remaining cards',()=>{expect(botColor([card('blue_1_0'),card('blue_2_0'),card('red_1_0')])).toBe('blue');});
});
describe('bounded reactions',()=>{
  const event=(id:string,playerId=id)=>({id,playerId,playerName:'Mate',key:'nice' as const,createdAt:now});
  it('deduplicates and limits visible reactions to three, one per player',()=>{
    let list=acceptReaction([],event('1'),now);expect(acceptReaction(list,event('1'),now)).toBe(list);
    for(let i=2;i<=5;i++)list=acceptReaction(list,event(String(i)),now);
    expect(list).toHaveLength(3);list=acceptReaction(list,event('6','5'),now);expect(list).toHaveLength(3);
    expect(list.filter(r=>r.playerId==='5')).toHaveLength(1);
  });
  it('does not replay stale or invalid reactions',()=>{
    expect(acceptReaction([],event('1'),now+6000)).toEqual([]);
    expect(acceptReaction([],{...event('1'),key:'invalid' as 'nice'},now)).toEqual([]);
  });
});
