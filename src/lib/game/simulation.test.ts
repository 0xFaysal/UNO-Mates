import {expect,it,vi} from 'vitest';
import {startNewGame} from './engine';
import {automaticTurn} from './automation';
import {freshTurn} from './turn-clock';

for(const count of [2,3,4,6,10])it(count+' players: seeded full rounds conserve all 108 cards and rank every finisher',()=>{
 for(let seed=1;seed<=8;seed++){
  let value=seed*101+count;const rng=()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296;};
  const random=vi.spyOn(Math,'random').mockImplementation(rng);
  try{
   let state=startNewGame('simulation',Array.from({length:count},(_,i)=>({id:'p'+i,name:'Mate '+i,avatarColor:'#ef4444',isHost:i===0})),rng);
   state.gameState=freshTurn({...state.gameState,players:state.gameState.players.map(p=>({...p,isBot:true,isOnline:false}))},1000000);
   for(let step=0;step<4000&&state.gameState.status==='playing';step++){
    const before=state.gameState,next=automaticTurn(state,new Set(),Math.max(before.turnDeadlineAt!,before.automationAt||0));
    expect(next,'no stalled turn, seed '+seed+', step '+step).not.toBeNull();state=next!;
    const game=state.gameState,all=[...state.drawPile,...game.discardPile,...Object.values(state.playerHands).flat()];
    expect(all).toHaveLength(108);expect(new Set(all.map(c=>c.id)).size).toBe(108);
    expect(game.drawPileCount).toBe(state.drawPile.length);expect(game.topDiscard.id).toBe(game.discardPile.at(-1)!.id);
    expect(game.version).toBeGreaterThan(before.version);
    const finish=game.finishOrder||[];expect(new Set(finish).size).toBe(finish.length);
    for(const player of game.players){expect(player.cardCount).toBe(state.playerHands[player.id].length);expect(player.score).toBe(0);}
    for(const id of finish.slice(0,game.status==='round_over'?-1:undefined))expect(state.playerHands[id]).toHaveLength(0);
    if(finish.length>(before.finishOrder?.length||0))expect(game.topDiscard.value).toMatch(/^\d$/);
    if(game.status==='playing'){expect(finish).not.toContain(game.players[game.turnIndex].id);expect(game.players[game.turnIndex].cardCount).toBeGreaterThan(0);}
   }
   expect(state.gameState.status,'round completion, seed '+seed).toBe('round_over');
   expect(new Set(state.gameState.finishOrder)).toEqual(new Set(state.gameState.players.map(p=>p.id)));
   expect(state.gameState.winnerPlayerId).toBe(state.gameState.finishOrder![0]);
  }finally{random.mockRestore();}
 }
},30000);
