import {createClassicDeck} from './deck';
import {playCardAction,drawCardAction,passTurnAction,chooseColorAction,callUnoAction,catchUnoAction} from './engine';
import {automaticTurn,resolveTablePresence} from './automation';
import {recordMove} from './presentation';
import type {CardColor,ServerAuthoritativeState} from './types';
import type {LessonId} from '../learning-contract';

export const LEARNER='practice-you',MANGO='practice-mango',BERRY='practice-berry';
export type PracticeAction={type:'play';cardId:string;uno?:boolean;color?:Exclude<CardColor,'wild'>}|{type:'draw'|'pass'|'uno'|'catch'|'continue'|'timeout'|'offline'|'close-table'|'chat'|'reactions'|'settings'|'rules'|'lobby'};
export interface PracticeSession {lesson:LessonId;stage:number;done:boolean;state:ServerAuthoritativeState;result?:string}
const cardKey=(color:string,value:string)=>color+'_'+value;
function fixture(lesson:LessonId,hand:string[],options:{top?:string;draw?:string;two?:boolean;turn?:number;otherHands?:string[][]}={}):ServerAuthoritativeState{
 const deck=createClassicDeck();
 const take=(key:string)=>{const card=deck.find(card=>cardKey(card.color,card.value)===key);if(!card)throw Error('Missing practice card '+key);deck.splice(deck.indexOf(card),1);return card;};
 const top=take(options.top||'red_5'),ids=options.two?[LEARNER,MANGO]:[LEARNER,MANGO,BERRY];
 const hands=Object.fromEntries(ids.map((id,i)=>[id,(i?(options.otherHands?.[i-1]||['red_'+(i+2),'red_'+(i+6),'blue_'+(i+1)]):hand).map(take)]));
 const draw=options.draw?take(options.draw):null;if(draw)deck.unshift(draw);
 const now=Date.now();return {drawPile:deck,playerHands:hands,gameState:{roomId:'practice',roundId:'practice-'+lesson,roundStartedAt:now,version:2,status:'playing',players:ids.map((id,i)=>({id,name:i?(i===1?'Mango Bot':'Berry Bot'):'You',avatarColor:['#f59e0b','#3b82f6','#8b5cf6'][i],cardCount:hands[id].length,isReady:true,isHost:i===0,isOnline:true,isComputer:i>0,hasCalledUno:false,score:0})),turnIndex:options.turn??0,turnDirection:1,activeColor:top.color,topDiscard:top,discardPile:[top],drawPileCount:deck.length,drawnCardPlayableId:null,pendingAction:{type:'none',playerId:''},unoChallengeablePlayerId:null,winnerPlayerId:null,finishOrder:[],lastActionDescription:'Practice with your robot coach.',updatedAt:now}};
}
/** Use the production engine for every card, declaration, catch and turn effect. */
function move(state:ServerAuthoritativeState,actor:string,action:PracticeAction,clock=false){
 const before=state.gameState;let next:ServerAuthoritativeState;let kind:'play'|'draw'|'color'|'other'='other';
 if(action.type==='play'){next=playCardAction(state,actor,action.cardId,Boolean(action.uno));if(action.color&&next.gameState.pendingAction.type!=='none')next=chooseColorAction(next,actor,action.color);kind='play';}
 else if(action.type==='draw'){next=drawCardAction(state,actor);kind='draw';}
 else if(action.type==='pass')next=passTurnAction(state,actor);
 else if(action.type==='uno')next=callUnoAction(state,actor);
 else if(action.type==='catch')next=catchUnoAction(state,actor,before.unoChallengeablePlayerId!);
 else throw Error('Not a card action');
 const recorded=recordMove(before,next.gameState,actor,kind,crypto.randomUUID());
 next.gameState=clock?recorded:{...recorded,turnStartedAt:undefined,turnDeadlineAt:undefined,automationAt:undefined,botCatchAt:undefined,botCatchTargetId:undefined};return next;
}
const play=(state:ServerAuthoritativeState,actor:string,value:string,color?:Exclude<CardColor,'wild'>,uno=false)=>{
 const card=state.playerHands[actor].find(card=>cardKey(card.color,card.value)===value);if(!card)throw Error('Robot card missing '+value);return move(state,actor,{type:'play',cardId:card.id,color,uno});
};
export function startPractice(lesson:LessonId):PracticeSession{
 let state:ServerAuthoritativeState;
 switch(lesson){
  case 'welcome':state=fixture(lesson,['red_1','red_7','blue_3','green_8','yellow_2','red_skip','wild_wild'],{otherHands:[['blue_0','blue_1','blue_2','blue_3','blue_4','blue_5','blue_6'],['green_0','green_1','green_2','green_3','green_4','green_5','green_6']]});state.gameState.version=1;break;
  case 'color':state=fixture(lesson,['red_7','blue_8','yellow_2']);break;
  case 'number':state=fixture(lesson,['blue_5','green_8','yellow_2']);break;
  case 'skip':state=fixture(lesson,['blue_skip','green_8','red_2'],{top:'red_skip'});break;
  case 'reverse':state=fixture(lesson,['red_reverse','blue_8','green_2']);break;
  case 'reverse-two':state=fixture(lesson,['red_reverse','blue_8','green_2'],{two:true});break;
  case 'draw':state=fixture(lesson,['blue_8','green_2'],{draw:'yellow_3'});break;
  case 'draw-play':case 'draw-pass':state=fixture(lesson,['red_9','blue_8'],{draw:'red_7'});break;
  case 'wild':state=fixture(lesson,['wild_wild','blue_8','red_2']);break;
  case 'stack-two':case 'escalate':state=fixture(lesson,[lesson==='stack-two'?'green_draw2':'wild_draw4','red_skip','blue_8'],{turn:2,otherHands:[['blue_3','blue_7'],['red_draw2','blue_2']]});state=play(state,BERRY,'red_draw2');break;
  case 'four-only':state=fixture(lesson,['wild_draw4','red_draw2','red_skip','blue_8','wild_wild'],{turn:2,otherHands:[['blue_3','blue_7'],['wild_draw4','blue_2']]});state=play(state,BERRY,'wild_draw4','red');break;
  case 'take-stack':state=fixture(lesson,['blue_8','red_skip'],{turn:1,otherHands:[['wild_draw4','blue_3'],['wild_draw4','blue_2']]});state=play(state,MANGO,'wild_draw4','red');state=play(state,BERRY,'wild_draw4','red');break;
  case 'uno':case 'late-uno':case 'forgot':state=fixture(lesson,['red_7','blue_8']);break;
  case 'catch':state=fixture(lesson,['red_7','green_8'],{turn:2,otherHands:[['blue_3','blue_7'],['red_6','blue_2']]});state=play(state,BERRY,'red_6');break;
  case 'final-power':state=fixture(lesson,['red_skip'],{draw:'blue_3'});break;
  case 'finish':state=fixture(lesson,['red_7'],{otherHands:[['red_8'],['red_9']]});state.gameState.players[0].hasCalledUno=true;break;
  case 'timer':state=fixture(lesson,['blue_8','green_2'],{draw:'yellow_3'});state.gameState={...state.gameState,turnToken:crypto.randomUUID(),turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+20000};break;
  case 'offline':state=fixture(lesson,['blue_8','green_2'],{otherHands:[['red_3','red_7','red_9'],['red_4','red_6','red_8']]});state.gameState.players[1]={...state.gameState.players[1],isComputer:false,name:'Connected Mate'};break;
  default:state=fixture(lesson,['red_7','blue_8','green_2']);
 }
 return {lesson,stage:0,done:false,state};
}
export function expectedPractice(session:PracticeSession):{type:PracticeAction['type'];value?:string;uno?:boolean}{
 if(session.done)return {type:'continue'};
 const {lesson,stage,state}=session;
 switch(lesson){
  case 'color':return {type:'play',value:'red_7'};
  case 'number':return {type:'play',value:'blue_5'};
  case 'skip':return {type:'play',value:'blue_skip'};
  case 'reverse':case 'reverse-two':return {type:'play',value:'red_reverse'};
  case 'draw':case 'final-power':case 'take-stack':return {type:'draw'};
  case 'draw-play':return stage===0?{type:'draw'}:{type:'play',value:cardKey(state.playerHands[LEARNER].find(card=>card.id===state.gameState.drawnCardPlayableId)!.color,'7')};
  case 'draw-pass':return {type:stage===0?'draw':'pass'};
  case 'wild':return {type:'play',value:'wild_wild'};
  case 'stack-two':return {type:'play',value:'green_draw2'};
  case 'escalate':case 'four-only':return {type:'play',value:'wild_draw4'};
  case 'uno':return {type:'play',value:'red_7',uno:true};
  case 'late-uno':return stage===0?{type:'play',value:'red_7',uno:false}:{type:'uno'};
  case 'forgot':return {type:'play',value:'red_7',uno:false};
  case 'catch':return {type:'catch'};
  case 'finish':return stage===0?{type:'play',value:'red_7'}:{type:'continue'};
  case 'timer':return {type:'timeout'};
  case 'offline':return {type:'offline'};
  case 'empty':return {type:'close-table'};
  case 'chat':case 'reactions':case 'settings':case 'rules':case 'lobby':return {type:lesson};
  default:return {type:'continue'};
 }
}
export function actPractice(session:PracticeSession,action:PracticeAction):PracticeSession{
 if(session.done)throw Error('This lesson is complete. Continue to the next one.');
 const expected=expectedPractice(session),card=action.type==='play'?session.state.playerHands[LEARNER].find(card=>card.id===action.cardId):null;
 if(action.type!==expected.type||(expected.value&&(!card||cardKey(card.color,card.value)!==expected.value)))throw Error('Follow the highlighted practice task first.');
 if(action.type==='play'&&expected.uno!==undefined&&Boolean(action.uno)!==expected.uno)throw Error(expected.uno?'Arm UNO first, then play the card.':'For this example, leave UNO unarmed.');
 if(action.type==='play'&&card?.color==='wild'&&!action.color)throw Error('Choose the next color.');
 let state=structuredClone(session.state),done=true,result:string|undefined;
 if(['play','draw','pass','uno','catch'].includes(action.type))state=move(state,LEARNER,action);
 if((session.lesson==='draw-play'||session.lesson==='draw-pass'||session.lesson==='late-uno')&&session.stage===0)done=false;
 if(session.lesson==='forgot')state=move(state,MANGO,{type:'catch'});
 if(session.lesson==='lobby')done=session.stage===2;
 if(session.lesson==='finish'){
  if(session.stage===0)done=false;
  else state=play(state,MANGO,'red_8');
 }
 if(action.type==='timeout'){
  const now=(state.gameState.turnDeadlineAt||Date.now())+1;state=automaticTurn(state,new Set([LEARNER]),now)!;result='timeout';
 }
 if(action.type==='offline'){
  const now=Date.now();state.gameState={...state.gameState,turnStartedAt:now-20000,turnDeadlineAt:now-1,automationAt:session.stage===2?now-1:undefined};
  state=automaticTurn(state,new Set([MANGO]),now)!;
  if(session.stage<2){
   state=play(state,MANGO,session.stage===0?'red_3':'red_7');state=play(state,BERRY,session.stage===0?'red_4':'red_6');done=false;
  }else result='auto';
 }
 if(action.type==='close-table'){
  const now=(state.gameState.emptySinceAt||Date.now())+(session.stage?15001:0);
  state=resolveTablePresence(state,new Set(),now)!;done=session.stage===1;
 }
 return {...session,state,stage:session.stage+1,done,result};
}
