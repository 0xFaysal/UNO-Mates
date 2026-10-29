import type {GameState, TableMove} from './types';

export const TURN_MS = 20_000;
export const BOT_DELAY_MS = 1_200;
export const openingDealMs = (count:number) => 1160 + count * 7 * Math.max(38,86-count*5);

export function freshTurn(game:GameState, now=Date.now(), token=crypto.randomUUID()):GameState {
  if(game.status!=='playing')return {...game,turnStartedAt:undefined,turnDeadlineAt:undefined,turnToken:undefined,automationAt:undefined};
  const player=game.players[game.turnIndex];
  return {...game,turnStartedAt:now,turnDeadlineAt:now+TURN_MS,turnToken:token,automationAt:player?.isBot&&!player.isOnline?now+BOT_DELAY_MS:undefined};
}

/** A draw-and-play, UNO call or Catch never buys another twenty seconds. */
export function clockAfterMove(before:GameState,after:GameState,type:TableMove['type'],id:string,now=Date.now()):GameState {
  if(after.status!=='playing')return freshTurn(after,now,id);
  if(type==='start')return freshTurn(after,now+openingDealMs(after.players.length),id);
  const ended=type==='timeout'||before.turnIndex!==after.turnIndex||
    (type==='play'&&after.pendingAction.type==='none')||
    (type==='color'&&after.pendingAction.type==='none');
  return ended?freshTurn(after,now,id):{...after,turnStartedAt:before.turnStartedAt,turnDeadlineAt:before.turnDeadlineAt,turnToken:before.turnToken,automationAt:before.automationAt};
}
