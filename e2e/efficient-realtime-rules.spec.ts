import {test,expect,type BrowserContext} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import {createClassicDeck} from '../src/lib/game/deck';
import type {GameSnapshot,GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());

test('shared transport preserves stacks, skip, reverse, wild color and off-turn UNO catch',async({browser},info)=>{
 test.setTimeout(120000);
 const contexts:BrowserContext[]=[],ids:string[]=[];let code='',roomId='';
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  for(let i=0;i<4;i++){
   const context=await browser.newContext({...info.project.use,reducedMotion:'reduce'});contexts.push(context);
   const response=await context.request.post('/api/rooms/'+(i?'join':'create'),{data:{...(i?{code}:{}),name:'Rules Mate '+i,avatarColor:'#3b82f6'}});expect(response.ok()).toBe(true);const data=await response.json();ids.push(data.player.id);if(!i){code=data.roomCode;roomId=data.roomId;}else expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await db.from('rooms').update({realtime_v2_enabled:true}).eq('id',roomId)).error).toBeNull();
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json(),deck=createClassicDeck();
  const take=(color:string,value:string)=>{const card=deck.find(card=>card.color===color&&card.value===value);expect(card).toBeTruthy();deck.splice(deck.indexOf(card!),1);return card!;};
  const top=take('red','0');
  const hands={
   [ids[0]]:[take('red','draw2'),take('blue','3'),take('red','9')],
   [ids[1]]:[take('green','draw2'),take('red','skip'),take('green','1'),take('blue','2')],
   [ids[2]]:[take('wild','draw4'),take('wild','wild'),take('red','7'),take('yellow','2')],
   [ids[3]]:[take('wild','draw4'),take('red','reverse'),take('blue','8'),take('red','5')],
  };
  const state:GameState={...initial.publicState,version:initial.publicState.version+1,roundStartedAt:Date.now()-60000,openingDealPending:false,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:undefined,drawPileCount:deck.length,players:initial.publicState.players.map(p=>({...p,cardCount:hands[p.id].length}))};
  expect((await db.from('game_states').update({version:state.version,public_state:state,secret_state:{drawPile:deck,playerHands:hands},clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  const pages=await Promise.all(contexts.map(context=>context.newPage()));await Promise.all(pages.map(page=>page.goto('/game/'+code)));
  for(let i=0;i<4;i++){await expect(pages[i].locator('[data-table-phase="idle"]')).toBeVisible({timeout:25000});await expect(pages[i].locator('footer img')).toHaveCount(hands[ids[i]].length);}
  async function action(index:number,data:Record<string,unknown>){const response=await contexts[index].request.post('/api/game/'+code+'/action',{data});expect(response.ok(),await response.text()).toBe(true);return await response.json() as GameSnapshot;}
  const play=(index:number,position:number,color?:string)=>action(index,{action:'play_card',cardId:hands[ids[index]][position].id,hasCalledUno:false,...(color?{color}:{})});
  expect((await play(0,0)).publicState.drawPenalty?.amount).toBe(2);
  expect((await contexts[1].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:hands[ids[1]][1].id}})).ok()).toBe(false);
  expect((await play(1,0)).publicState.drawPenalty?.amount).toBe(4);
  expect((await play(2,0,'red')).publicState.drawPenalty?.amount).toBe(8);
  expect((await contexts[3].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:hands[ids[3]][1].id}})).ok()).toBe(false);
  expect((await play(3,0,'red')).publicState.drawPenalty?.amount).toBe(12);
  const drawn=await action(0,{action:'draw_card'});expect(drawn.myHand).toHaveLength(14);expect(drawn.publicState.drawPenalty).toBeUndefined();await expect(pages[0].locator('footer img')).toHaveCount(14);
  expect((await play(1,1)).publicState.turnIndex).toBe(3);
  const reversed=await play(3,1);expect(reversed.publicState.turnDirection).toBe(-1);expect(reversed.publicState.turnIndex).toBe(2);
  expect((await play(2,1,'blue')).publicState.activeColor).toBe('blue');
  const uno=await play(1,3);expect(uno.publicState.unoChallengeablePlayerId).toBe(ids[1]);await expect(pages[1].locator('footer img')).toHaveCount(1);
  const caught=await action(0,{action:'catch_uno',targetPlayerId:ids[1]});expect(caught.publicState.players[1].cardCount).toBe(3);expect(caught.publicState.turnIndex).toBe(0);await expect(pages[1].locator('footer img')).toHaveCount(3);
  for(let i=0;i<4;i++)await expect(pages[i].locator('[data-player-anchor="'+ids[0]+'"][data-active="true"]')).toBeVisible();
 }finally{await Promise.allSettled(contexts.map(context=>context.close()));if(roomId)expect((await db.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
