import type {Card,GameState} from './types';
export function ruleHint(game:GameState,hand:Card[],selectedId:string|null):string|null {
  if(hand.length===1&&!/^\d$/.test(hand[0].value))return 'Final card must be a number. Draw to continue.';
  if(hand.length===2&&selectedId){
    const selected=hand.find(c=>c.id===selectedId),remaining=hand.find(c=>c.id!==selectedId);
    if(selected&&remaining&&/^\d$/.test(selected.value)&&!/^\d$/.test(remaining.value))return 'Keep a number for your final card.';
  }
  if(game.drawPenalty)return game.drawPenalty.value==='draw4'?'Only +4 can stack. Otherwise draw '+game.drawPenalty.amount+'.':'Stack +2 or +4, or draw '+game.drawPenalty.amount+'.';
  return null;
}
