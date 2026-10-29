import { test,expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { createClassicDeck } from '../src/lib/game/deck';
import type { GameSnapshot } from '../src/lib/game/types';
loadEnvConfig(process.cwd());

test('UNO draws attention when needed, stops when armed, and Catch resolves a missed call',async({browser},testInfo)=>{
 test.setTimeout(100000);
 const host=await browser.newContext({...testInfo.project.use,reducedMotion:'no-preference'}),guest=await browser.newContext({...testInfo.project.use,reducedMotion:'no-preference'});
 try{
  const created=await host.request.post('/api/rooms/create',{data:{name:'GlowHost',avatarColor:'#ef4444'}});expect(created.ok()).toBe(true);const {roomCode:code,player:hpRecord}=await created.json();
  const joined=await guest.request.post('/api/rooms/join',{data:{code,name:'GlowMate',avatarColor:'#3b82f6'}});expect(joined.ok()).toBe(true);const {player:gpRecord}=await joined.json();
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();
  const deck=createClassicDeck(),top=deck.find(c=>c.id==='red_0_0')!,one=deck.find(c=>c.id==='red_1_0')!,two=deck.find(c=>c.id==='red_2_0')!;
  const used=new Set([top.id,one.id,two.id]),mateHand=deck.filter(c=>!used.has(c.id)).slice(0,7);for(const c of mateHand)used.add(c.id);
  const drawPile=deck.filter(c=>!used.has(c.id));
  const state={...initial.publicState,version:initial.publicState.version+1,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,unoChallengeablePlayerId:null,finishOrder:[],winnerPlayerId:null,lastMove:undefined,drawPileCount:drawPile.length,players:initial.publicState.players.map((p,i)=>({...p,cardCount:i?7:2,hasCalledUno:false}))};
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await admin.from('game_states').update({version:state.version,public_state:state,secret_state:{drawPile,playerHands:{[hpRecord.id]:[one,two],[gpRecord.id]:mateHand}}}).eq('room_id',state.roomId)).error).toBeNull();
  const hp=await host.newPage(),gp=await guest.newPage();await hp.setViewportSize({width:320,height:568});await gp.setViewportSize({width:320,height:568});
  await Promise.all([hp.goto('/game/'+code),gp.goto('/game/'+code)]);
  const uno=hp.getByRole('button',{name:'UNO',exact:true});await expect(uno).toBeVisible({timeout:30000});
  await expect(uno.locator('.card-action-frame')).toBeVisible();expect(await uno.evaluate(el=>getComputedStyle(el,'::after').animationName)).not.toBe('none');
  const idle=gp.getByRole('button',{name:'UNO',exact:true});await expect(idle).toBeVisible({timeout:30000});expect(await idle.evaluate(el=>getComputedStyle(el).backgroundImage)).not.toBe('none');await expect(idle.locator('.card-action-frame')).toHaveCount(0);
  await hp.screenshot({path:'test-results/uno-attention.png'});
  await uno.click();const armed=hp.getByRole('button',{name:'UNO armed',exact:true});await expect(armed).toHaveAttribute('aria-pressed','true');await expect(armed.locator('.card-action-frame')).toHaveCount(0);expect(await armed.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
  await armed.click();
  expect((await host.request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:one.id,hasCalledUno:false}})).ok()).toBe(true);
  const catchButton=gp.getByRole('button',{name:'Catch GlowHost',exact:true});await expect(catchButton).toBeVisible({timeout:15000});await expect(catchButton.locator('.card-action-frame')).toBeVisible();expect(await catchButton.evaluate(el=>getComputedStyle(el).backgroundImage)).not.toBe('none');
  expect(await catchButton.evaluate(el=>getComputedStyle(el,'::after').animationName)).not.toBe('none');
  await gp.screenshot({path:'test-results/catch-attention.png'});
  await gp.emulateMedia({reducedMotion:'reduce'});expect(await catchButton.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');expect(await catchButton.locator('.card-action-frame').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  await catchButton.click();await expect(catchButton).toHaveCount(0,{timeout:15000});
  const caught:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();expect(caught.myHand).toHaveLength(3);expect(caught.publicState.unoChallengeablePlayerId).toBeNull();
 }finally{await host.close();await guest.close();}
});
