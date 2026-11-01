import {describe,it,expect} from 'vitest';
import {LESSON_IDS,safeLearningReturn} from '../learning-contract';
import {startPractice,actPractice,expectedPractice,LEARNER,MANGO,BERRY,type PracticeAction} from './learning';
import {canPlayCard} from './engine';
import {learningCopy} from './learning-copy';

function complete(id:typeof LESSON_IDS[number]){
 let session=startPractice(id),steps=0;
 while(!session.done&&steps++<5){const expected=expectedPractice(session);let action:PracticeAction;
  if(expected.type==='play'){const card=session.state.playerHands[LEARNER].find(card=>card.color+'_'+card.value===expected.value)!;expect(card).toBeTruthy();expect(canPlayCard(card,session.state.gameState,session.state.playerHands[LEARNER].length)).toBe(true);action={type:'play',cardId:card.id,uno:expected.uno,color:card.color==='wild'?'blue':undefined};}
  else action={type:expected.type} as PracticeAction;
  session=actPractice(session,action);
  const all=[...session.state.drawPile,...session.state.gameState.discardPile,...Object.values(session.state.playerHands).flat()];expect(all).toHaveLength(108);expect(new Set(all.map(card=>card.id)).size).toBe(108);
  for(const player of session.state.gameState.players)expect(player.cardCount).toBe(session.state.playerHands[player.id].length);
 }
 expect(session.done).toBe(true);expect(steps).toBeLessThanOrEqual(4);return session.state;
}
describe('guided learning uses the real house-rule engine',()=>{
 for(const id of LESSON_IDS)it('completes '+id+' with conserved private hands and meaningful bilingual instructions',()=>{
  complete(id);for(const lang of ['bn','en'] as const){const copy=learningCopy(id,0,lang);expect(copy.title.length).toBeGreaterThan(4);expect(copy.task.length).toBeGreaterThan(8);}
 });
 it('demonstrates stacks of four, six and eight, full penalties, and the two-player reverse',()=>{
  expect(complete('stack-two').gameState.drawPenalty?.amount).toBe(4);expect(complete('escalate').gameState.drawPenalty?.amount).toBe(6);expect(complete('four-only').gameState.drawPenalty?.amount).toBe(8);
  expect(complete('take-stack').playerHands[LEARNER]).toHaveLength(10);expect(complete('take-stack').gameState.drawPenalty).toBeUndefined();expect(complete('reverse-two').gameState.turnIndex).toBe(0);
 });
 it('teaches actual UNO declarations, catch penalties, automatic last place and offline takeover',()=>{
  expect(complete('uno').gameState.players[0].hasCalledUno).toBe(true);expect(complete('late-uno').gameState.unoChallengeablePlayerId).toBeNull();expect(complete('catch').playerHands[BERRY]).toHaveLength(3);expect(complete('forgot').playerHands[LEARNER]).toHaveLength(3);
  expect(complete('finish').gameState.finishOrder).toEqual([LEARNER,MANGO,BERRY]);expect(complete('offline').gameState.players[0].isBot).toBe(true);expect(complete('empty').gameState.endReason).toBe('all_offline');
 });
 it('requires the taught action without mutating the scenario, and never teaches a power-card finish',()=>{
  const lesson=startPractice('uno');expect(()=>actPractice(lesson,{type:'play',cardId:lesson.state.playerHands[LEARNER][0].id,uno:false})).toThrow('Arm UNO');expect(lesson.state.playerHands[LEARNER]).toHaveLength(2);
  const final=startPractice('final-power');expect(canPlayCard(final.state.playerHands[LEARNER][0],final.state.gameState,1)).toBe(false);
 });
 it('preserves safe invitations and rejects external or arbitrary return URLs',()=>{
  expect(safeLearningReturn('/join?code=ABC123')).toBe('/join?code=ABC123');expect(safeLearningReturn('//evil.example')).toBe('/');expect(safeLearningReturn('https://evil.example')).toBe('/');expect(safeLearningReturn('/api/admin/stats')).toBe('/');
 });
});
