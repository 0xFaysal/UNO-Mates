import { test,expect,type BrowserContext,type Locator } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { createClassicDeck } from '../src/lib/game/deck';
import type { GameSnapshot } from '../src/lib/game/types';
loadEnvConfig(process.cwd());
async function hasParticles(canvas:Locator){return canvas.evaluate(node=>{const c=node as HTMLCanvasElement;const pixels=c.getContext('2d')?.getImageData(0,0,c.width,c.height).data;if(!pixels)return false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)return true;return false;});}

test('confirmed finishes celebrate once, rejected finishes do not, and results celebrate inside the dialog',async({browser},testInfo)=>{
 test.setTimeout(120000);const contexts:BrowserContext[]=[],ids:string[]=[];let code='';
 try{
  for(let i=0;i<3;i++){
   const context=await browser.newContext({...testInfo.project.use,reducedMotion:i===1?'reduce':'no-preference'});contexts.push(context);
   const response=await context.request.post(i?'/api/rooms/join':'/api/rooms/create',{data:{...(i?{code}:{}),name:['ConfettiHost','ConfettiMate','LastMate'][i],avatarColor:['#ef4444','#3b82f6','#10b981'][i]}});
   expect(response.ok()).toBe(true);const data=await response.json();if(!i)code=data.roomCode;ids.push(data.player.id);
   if(i)expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  const deck=createClassicDeck(),top=deck.find(c=>c.id==='red_0_0')!,cards=['red_1_0','red_2_0','red_3_0'].map(id=>deck.find(c=>c.id===id)!);
  const used=new Set([top.id,...cards.map(c=>c.id)]),drawPile=deck.filter(c=>!used.has(c.id));
  const state={...initial.publicState,openingDealPending:false,openingNotBeforeAt:undefined,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:undefined,version:initial.publicState.version+1,turnIndex:0,turnDirection:1,activeColor:'red',topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],pendingAction:{type:'none',playerId:''},drawPenalty:undefined,drawnCardPlayableId:null,unoChallengeablePlayerId:null,finishOrder:[],winnerPlayerId:null,lastMove:undefined,drawPileCount:drawPile.length,players:initial.publicState.players.map(p=>({...p,cardCount:1,hasCalledUno:false}))};
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await admin.from('game_states').update({version:state.version,public_state:state,secret_state:{drawPile,playerHands:Object.fromEntries(ids.map((id,i)=>[id,[cards[i]]]))}}).eq('room_id',state.roomId)).error).toBeNull();
  const hp=await contexts[0].newPage(),gp=await contexts[1].newPage();await hp.setViewportSize({width:393,height:727});
  await Promise.all([hp.goto('/game/'+code),gp.goto('/game/'+code)]);await hp.bringToFront();
  await expect(hp.locator('footer [data-card-id]')).toHaveCount(1,{timeout:30000});
  await expect(gp.locator('footer [data-card-id]')).toHaveCount(1,{timeout:30000});
  const canvas=hp.getByTestId('finish-confetti');
  await hp.route('**/api/game/'+code+'/action',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Finish rejected. Try again.'})}));
  await hp.locator('[data-card-id="'+cards[0].id+'"]').getByRole('button').click();await hp.getByRole('button',{name:'Play Card',exact:true}).click();
  await expect(hp.getByRole('alert',{name:'Move error'})).toContainText('Finish rejected');await expect(hp.locator('footer [data-card-id]')).toHaveCount(1);await expect(canvas).toHaveAttribute('data-celebration-count','0');
  await hp.unroute('**/api/game/'+code+'/action');await hp.getByRole('button',{name:'Play Card',exact:true}).click();
  await expect(hp.getByTestId('finished-status')).toContainText('#1');await expect(canvas).toHaveAttribute('data-celebration-count','1');await expect(canvas).toHaveAttribute('data-last-finisher',ids[0]);
  await expect.poll(()=>hasParticles(canvas)).toBe(true);await hp.screenshot({path:'test-results/finish-confetti.png'});
  await expect(gp.getByTestId('finish-confetti')).toHaveAttribute('data-celebration-count','0');
  const resync=hp.waitForResponse(r=>r.url().endsWith('/api/game/'+code)&&r.request().method()==='GET');await hp.evaluate(()=>window.dispatchEvent(new Event('online')));await resync;await expect(canvas).toHaveAttribute('data-celebration-count','1');
  expect((await contexts[1].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:cards[1].id}})).ok()).toBe(true);
  const dialog=hp.getByRole('dialog',{name:'Final rankings'});await expect(dialog).toBeVisible({timeout:15000});
  const finalCanvas=dialog.getByTestId('results-confetti');await expect(finalCanvas).toHaveAttribute('data-celebration-count','1');await expect.poll(()=>hasParticles(finalCanvas)).toBe(true);await hp.screenshot({path:'test-results/results-confetti.png'});
  await expect(canvas).toHaveAttribute('data-celebration-count','1');
 }finally{await Promise.allSettled(contexts.map(context=>context.close()));}
});
