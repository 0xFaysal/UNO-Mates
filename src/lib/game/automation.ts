import type {Card,CardColor,GameState,ServerAuthoritativeState} from './types';
import {canPlayCard,chooseColorAction,drawCardAction,getNextActiveTurnIndex,playCardAction} from './engine';
import {recordMove} from './presentation';
import {freshTurn} from './turn-clock';

export function botColor(hand:Card[]):Exclude<CardColor,'wild'> {
  const colors=['red','yellow','green','blue'] as const;
  return [...colors].sort((a,b)=>hand.filter(c=>c.color===b).length-hand.filter(c=>c.color===a).length)[0];
}

/** Uses only this player's hand and public state. Never inspects an opponent's hand. */
export function botCard(game:GameState,hand:Card[]):Card|undefined {
  const legal=hand.filter(c=>canPlayCard(c,game,hand.length)&&(!game.drawnCardPlayableId||game.drawnCardPlayableId===c.id));
  const score=(card:Card)=>{
    const remaining=hand.filter(c=>c.id!==card.id);
    const keepNumber=remaining.length===1&&!/^\d$/.test(remaining[0].value)?-100:0;
    return keepNumber+(card.color==='wild'?10:30)+hand.filter(c=>c.color===card.color).length;
  };
  return legal.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
}

export function automaticTurn(state:ServerAuthoritativeState,onlineIds:ReadonlySet<string>,now=Date.now()):ServerAuthoritativeState|null {
  const game=state.gameState;
  if(game.status!=='playing'||!game.turnDeadlineAt)return null;
  const player=game.players[game.turnIndex];
  if(!player)return null;
  if(game.openingDealPending){
    if(now<game.turnDeadlineAt)return null;
    if(onlineIds.has(player.id)&&game.openingHardDeadlineAt&&now<game.openingHardDeadlineAt){
      return {...state,gameState:{...game,turnDeadlineAt:game.openingHardDeadlineAt,version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
    }
    // An absent first player cannot leave the room waiting for a browser acknowledgement.
    return {...state,gameState:{...freshTurn(game,now),version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
  }
  const online=onlineIds.has(player.id);
  const botDue=player.isBot&&!online&&Boolean(game.automationAt&&game.automationAt<=now);
  if(online&&player.isBot){
    return {...state,gameState:{...game,players:game.players.map(p=>p.id===player.id?{...p,isOnline:true,isBot:false,offlineMisses:0}:p),automationAt:undefined,version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId:player.id,draws:[]}}};
  }
  if(!botDue&&now<game.turnDeadlineAt)return null;
  const input=structuredClone(state);
  const actor=input.gameState.players[input.gameState.turnIndex];
  actor.isOnline=online;
  const id=crypto.randomUUID();
  let next:ServerAuthoritativeState;
  if(botDue||(actor.isBot&&!online)){
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
    actor.isBot=!online&&actor.offlineMisses>=3;
    if(input.gameState.pendingAction.type!=='none'){
      next=chooseColorAction(input,actor.id,botColor(input.playerHands[actor.id]||[]));
      if(next.gameState.turnIndex===game.turnIndex)next=skip(next,now);
    }else if(input.gameState.drawPenalty){next=drawCardAction(input,actor.id);}
    else next=skip(input,now);
    next.gameState.lastActionDescription=actor.name+' ran out of time'+(game.drawPenalty?' and drew the stack.':'. Turn passed.')+(actor.isBot?' Auto-play enabled after 3 offline misses.':'');
    next.gameState=recordMove(game,next.gameState,actor.id,'timeout',id,now);
  }
  next.gameState.updatedAt=now;
  return next;
}

function skip(state:ServerAuthoritativeState,now:number):ServerAuthoritativeState {
  const game=state.gameState;
  return {...state,gameState:{...game,turnIndex:getNextActiveTurnIndex(game,game.turnIndex,game.turnDirection),drawnCardPlayableId:null,unoChallengeablePlayerId:null,version:game.version+1,updatedAt:now}};
}
