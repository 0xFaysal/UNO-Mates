import type {GameState, TableMove} from './types';

export const TURN_MS = 20_000;
export const BOT_DELAY_MS = 1_200;
export const OPENING_READY_GRACE_MS = 15_000;
export const OPENING_CONNECTED_GRACE_MS = 45_000;
export const openingDealMs = (count:number) => 1160 + count * 7 * Math.max(38,86-count*5);

export function freshTurn(game:GameState, now=Date.now(), token=crypto.randomUUID()):GameState {
  if(game.status!=='playing')return {...game,turnStartedAt:undefined,turnDeadlineAt:undefined,turnToken:undefined,automationAt:undefined,openingDealPending:undefined,openingNotBeforeAt:undefined,openingHardDeadlineAt:undefined};
  const player=game.players[game.turnIndex];
  return {...game,turnStartedAt:now,turnDeadlineAt:now+TURN_MS,turnToken:token,automationAt:player?.isBot&&!player.isOnline?now+BOT_DELAY_MS:undefined,openingDealPending:undefined,openingNotBeforeAt:undefined,openingHardDeadlineAt:undefined};
}

/** The initial deadline is a bounded readiness fallback, not time to play. */
export function openingTurn(game:GameState,now=Date.now(),token=crypto.randomUUID()):GameState {
  const readyAt=now+openingDealMs(game.players.length);
  return {...freshTurn(game,now,token),openingDealPending:true,openingNotBeforeAt:readyAt,openingHardDeadlineAt:readyAt+OPENING_CONNECTED_GRACE_MS,turnStartedAt:undefined,turnDeadlineAt:readyAt+OPENING_READY_GRACE_MS,automationAt:undefined};
}

export function confirmOpeningReady(game:GameState,playerId:string,roundId:string,token:string,now=Date.now()):GameState {
  if(game.roundId!==roundId)throw new Error('The round changed. Reconnect to continue.');
  if(!game.openingDealPending||game.status!=='playing')return game;
  if(game.players[game.turnIndex]?.id!==playerId)throw new Error('Only the first player can start this turn.');
  if(game.turnToken!==token)throw new Error('The turn changed. Reconnect to continue.');
  return {...freshTurn(game,Math.max(now,game.openingNotBeforeAt||now)),version:game.version+1,updatedAt:now,lastMove:{id:crypto.randomUUID(),type:'presence',playerId,draws:[]}};
}

/** A draw-and-play, UNO call or Catch never buys another twenty seconds. */
export function clockAfterMove(before:GameState,after:GameState,type:TableMove['type'],id:string,now=Date.now()):GameState {
  if(after.status!=='playing')return freshTurn(after,now,id);
  if(type==='start')return openingTurn(after,now,id);
  if(before.openingDealPending)return freshTurn(after,now,id);
  const ended=type==='timeout'||before.turnIndex!==after.turnIndex||
    (type==='play'&&after.pendingAction.type==='none')||
    (type==='color'&&after.pendingAction.type==='none');
  return ended?freshTurn(after,now,id):{...after,turnStartedAt:before.turnStartedAt,turnDeadlineAt:before.turnDeadlineAt,turnToken:before.turnToken,automationAt:before.automationAt};
}
