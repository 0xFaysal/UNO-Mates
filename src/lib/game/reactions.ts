export const TABLE_REACTIONS = [
  {key:'nice',emoji:'👏',label:'Nice move',sound:'reactNice'},
  {key:'laugh',emoji:'😂',label:'Laugh',sound:'reactLaugh'},
  {key:'oops',emoji:'😅',label:'Unlucky',sound:'reactOops'},
  {key:'wow',emoji:'😮',label:'Wow',sound:'reactWow'},
] as const;
export type ReactionKey = typeof TABLE_REACTIONS[number]['key'];
export interface TableReaction {id:string;playerId:string;playerName:string;key:ReactionKey;createdAt:number}

export function acceptReaction(list:TableReaction[],incoming:TableReaction,now=Date.now()):TableReaction[]{
  if(!TABLE_REACTIONS.some(r=>r.key===incoming.key)||!Number.isFinite(incoming.createdAt)||Math.abs(now-incoming.createdAt)>5000||list.some(r=>r.id===incoming.id))return list;
  return [...list.filter(r=>now-r.createdAt<3000&&r.playerId!==incoming.playerId),incoming].slice(-3);
}
