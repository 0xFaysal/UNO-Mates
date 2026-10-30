import type {GameState,PlayerPublic} from './types';
export const BOT_THINK_MS=1200;
export const BOT_REACTION_MS=900;
export const isAutomated=(player:PlayerPublic)=>Boolean(player.isComputer||(player.isBot&&!player.isOnline));
/** Only a public missed-UNO window can schedule a robot reaction. No polling. */
export function scheduleBotCatch(game:GameState,now:number):GameState{
 const target=game.players.find(p=>p.id===game.unoChallengeablePlayerId);
 const eligible=game.status==='playing'&&target?.cardCount===1&&!target.hasCalledUno&&game.players.some(p=>p.id!==target.id&&p.cardCount>0&&!(game.finishOrder||[]).includes(p.id)&&isAutomated(p));
 if(!eligible)return {...game,botCatchAt:undefined,botCatchTargetId:undefined};
 if(game.botCatchTargetId===target.id&&game.botCatchAt)return game;
 return {...game,botCatchTargetId:target.id,botCatchAt:now+BOT_REACTION_MS};
}
