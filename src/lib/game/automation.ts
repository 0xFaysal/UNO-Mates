import type {Card,CardColor,GameState,ServerAuthoritativeState} from './types';
import {canPlayCard,catchUnoAction,chooseColorAction,drawCardAction,getNextActiveTurnIndex,playCardAction} from './engine';
import {recordMove} from './presentation';
import {freshTurn} from './turn-clock';
import {isAutomated} from './bots';

export function botColor(hand:Card[]):Exclude<CardColor,'wild'> {
  const colors=['red','yellow','green','blue'] as const;
  const weight=(color:string)=>hand.reduce((total,card)=>total+(card.color===color?(/^\d$/.test(card.value)?4:3):0),0);
  return [...colors].sort((a,b)=>weight(b)-weight(a))[0];
}

/** Uses only this player's hand and public state. Never inspects an opponent's hand. */
export function botCard(game:GameState,hand:Card[]):Card|undefined {
  const legal=hand.filter(c=>canPlayCard(c,game,hand.length)&&(!game.drawnCardPlayableId||game.drawnCardPlayableId===c.id));
  const score=(card:Card)=>{
    const remaining=hand.filter(c=>c.id!==card.id);
    const keepNumber=remaining.length===1&&!/^\d$/.test(remaining[0].value)?-400:0;
    const next=game.players[getNextActiveTurnIndex(game,game.turnIndex,game.turnDirection)];
    const threat=next?.cardCount<=2;
    const pressure=threat?(({skip:95,reverse:65,draw2:90,draw4:100} as Partial<Record<Card['value'],number>>)[card.value]||0):0;
    const continuity=remaining.filter(c=>c.color===card.color).length*5;
    const wildReserve=card.color==='wild'&&hand.length>3?-12:0;
    const shedPower=!/^\d$/.test(card.value)&&hand.length<=4?18:0;
    return keepNumber+pressure+continuity+wildReserve+shedPower+(card.color==='wild'?10:30);
  };
  return legal.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
}

export function automaticTurn(state:ServerAuthoritativeState,onlineIds:ReadonlySet<string>,now=Date.now()):ServerAuthoritativeState|null {
  const game=state.gameState;
  if(game.status!=='playing'||!game.turnDeadlineAt)return null;
  const player=game.players[game.turnIndex];
  if(!player)return null;
  if(game.openingDealPending){
    if(player.isComputer&&now>=(game.openingNotBeforeAt||game.turnDeadlineAt)){
      return {...state,gameState:{...freshTurn(game,now),version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
    }
    if(now<game.turnDeadlineAt)return null;
    if(onlineIds.has(player.id)&&game.openingHardDeadlineAt&&now<game.openingHardDeadlineAt){
      return {...state,gameState:{...game,turnDeadlineAt:game.openingHardDeadlineAt,version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
    }
    // An absent first player cannot leave the room waiting for a browser acknowledgement.
    return {...state,gameState:{...freshTurn(game,now),version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
  }
  const online=!player.isComputer&&onlineIds.has(player.id);
  const botDue=isAutomated(player)&&!online&&Boolean(game.automationAt&&game.automationAt<=now);
  if(online&&player.isBot&&!player.isComputer){
    return {...state,gameState:{...game,players:game.players.map(p=>p.id===player.id?{...p,isOnline:true,isBot:false,offlineMisses:0}:p),automationAt:undefined,version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
  }
  if(game.botCatchAt&&now>=game.botCatchAt){
    const target=game.players.find(p=>p.id===game.botCatchTargetId);
    const catcher=game.players.find(p=>p.id!==target?.id&&p.cardCount>0&&!(game.finishOrder||[]).includes(p.id)&&isAutomated(p)&&(p.isComputer||!onlineIds.has(p.id)));
    if(target&&target.id===game.unoChallengeablePlayerId&&target.cardCount===1&&!target.hasCalledUno&&catcher){
      const next=catchUnoAction(state,catcher.id,target.id);
      next.gameState=recordMove(game,next.gameState,catcher.id,'other',crypto.randomUUID(),now);next.gameState.updatedAt=now;return next;
    }
    return {...state,gameState:{...game,botCatchAt:undefined,botCatchTargetId:undefined,version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
  }
  if(!botDue&&now<game.turnDeadlineAt)return null;
  const input=structuredClone(state);
  const actor=input.gameState.players[input.gameState.turnIndex];
  actor.isOnline=online;
  const id=crypto.randomUUID();
  let next:ServerAuthoritativeState;
  if(botDue||actor.isComputer||(actor.isBot&&!online)){
    const hand=input.playerHands[actor.id]||[];
    if(input.gameState.pendingAction.type!=='none'){
      next=chooseColorAction(input,actor.id,botColor(hand));
      next.gameState=recordMove(game,next.gameState,actor.id,'color',id,now);
    }else{
      const card=botCard(input.gameState,hand);
      if(card){
        next=playCardAction(input,actor.id,card.id,hand.length===2);
        if(card.color==='wild')next=chooseColorAction(next,actor.id,botColor(hand.filter(c=>c.id!==card.id)));
        next.gameState=recordMove(game,next.gameState,actor.id,'play',id,now);
      }else if(!input.gameState.drawnCardPlayableId){
        try{next=drawCardAction(input,actor.id);}catch(error){
          if(!(error instanceof Error)||error.message!=='Draw pile is empty')throw error;
          next=skip(input,now);
        }
        next.gameState=recordMove(game,next.gameState,actor.id,'draw',id,now);
      }else{next=skip(input,now);next.gameState=recordMove(game,next.gameState,actor.id,'timeout',id,now);}
    }
  }else{
    actor.offlineMisses=online?0:(actor.offlineMisses||0)+1;
    actor.isBot=!online&&actor.offlineMisses>=2;
    if(input.gameState.pendingAction.type!=='none'){
      next=chooseColorAction(input,actor.id,botColor(input.playerHands[actor.id]||[]));
      if(next.gameState.turnIndex===game.turnIndex)next=skip(next,now);
    }else if(input.gameState.drawPenalty){next=drawCardAction(input,actor.id);}
    else next=skip(input,now);
    next.gameState.lastActionDescription=actor.name+' ran out of time'+(game.drawPenalty?' and drew the stack.':'. Turn passed.')+(actor.isBot?' Auto-play enabled after 2 offline misses.':'');
    next.gameState=recordMove(game,next.gameState,actor.id,'timeout',id,now);
  }
  next.gameState.updatedAt=now;
  return next;
}

function skip(state:ServerAuthoritativeState,now:number):ServerAuthoritativeState {
  const game=state.gameState;
  return {...state,gameState:{...game,turnIndex:getNextActiveTurnIndex(game,game.turnIndex,game.turnDirection),drawnCardPlayableId:null,unoChallengeablePlayerId:null,version:game.version+1,updatedAt:now}};
}
