import {test,expect,type BrowserContext} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
import type {GameSnapshot,GameState} from '../src/lib/game/types';
loadEnvConfig(process.cwd());

for(const count of [2,10])test(count+' players: the full first turn starts after a delayed deal, with a clear table clock',async({browser},testInfo)=>{
 test.setTimeout(140000);
 const contexts:BrowserContext[]=[];let code='',roomId='';
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  for(let i=0;i<count;i++){
   const context=await browser.newContext({...testInfo.project.use,viewport:{width:320,height:700},reducedMotion:'no-preference'});contexts.push(context);
   const response=await context.request.post('/api/rooms/'+(i?'join':'create'),{data:{...(i?{code}:{}),name:i?'Timer Mate '+i:'Timer Host',avatarColor:i?'#3b82f6':'#ef4444'}});
   expect(response.ok()).toBe(true);const data=await response.json();if(!i)code=data.roomCode;
   if(i)expect((await context.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  }
  expect((await contexts[0].request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();roomId=initial.publicState.roomId;
  const saved=await admin.from('game_states').select('secret_state').eq('room_id',roomId).single();expect(saved.error).toBeNull();
  const secret=saved.data!.secret_state;
  const top=secret.drawPile.find((card:{value:string})=>/^\d$/.test(card.value));
  const drawPile=secret.drawPile.filter((card:{id:string})=>card.id!==top.id);drawPile.push(initial.publicState.topDiscard);
  // Keep the worker fallback clear of cold compilation while this test deliberately gates the first connection.
  const game={...initial.publicState,turnDeadlineAt:Date.now()+60000,openingHardDeadlineAt:Date.now()+90000,turnIndex:0,turnDirection:1,topDiscard:top,discardPile:[top],recentPlays:[{card:top,playerId:null,name:'Opening card'}],activeColor:top.color,pendingAction:{type:'none',playerId:''},drawPenalty:undefined};
  expect((await admin.from('game_states').update({public_state:game,secret_state:{...secret,drawPile}}).eq('room_id',roomId)).error).toBeNull();
  const page=await contexts[0].newPage();
  let gotSnapshot=()=>{},releaseSnapshot=()=>{},gotReady=()=>{},releaseReady=()=>{};
  const snapshotRequested=new Promise<void>(resolve=>{gotSnapshot=resolve;}),snapshotGate=new Promise<void>(resolve=>{releaseSnapshot=resolve;});
  const readyRequested=new Promise<void>(resolve=>{gotReady=resolve;}),readyGate=new Promise<void>(resolve=>{releaseReady=resolve;});
  await page.route('**/api/game/'+code,async route=>{gotSnapshot();await snapshotGate;await route.continue();});
  await page.route('**/api/game/'+code+'/ready',async route=>{gotReady();await readyGate;await route.continue();});
  await page.goto('/game/'+code);await snapshotRequested;
  // Reproduce a slow initial connection: this used to consume the first player's time.
  await page.waitForTimeout(5000);releaseSnapshot();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','deal',{timeout:20000});
  await expect(page.getByTestId('turn-clock')).toHaveCount(0);await expect(page.getByTestId('turn-clock-ring')).toHaveCount(0);
  await readyRequested;
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle');
  await expect(page.locator('footer [data-card-id]')).toHaveCount(7);
  await expect(page.getByTestId('turn-clock')).toHaveCount(0);
  const pilesBeforeClock=await page.locator('.table-piles').boundingBox();
  const pending:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();expect(pending.publicState.openingDealPending).toBe(true);expect(pending.publicState.turnStartedAt).toBeUndefined();
  const wrong=await contexts[1].request.post('/api/game/'+code+'/ready',{data:{roundId:game.roundId,turnToken:game.turnToken}});expect(wrong.status()).toBe(409);
  releaseReady();
  await expect(page.getByTestId('turn-clock')).toBeVisible();await expect(page.getByTestId('turn-clock-ring')).toHaveCount(1);
  const started:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  expect(started.publicState.turnDeadlineAt!-started.publicState.turnStartedAt!).toBe(20000);
  expect(started.publicState.turnStartedAt!).toBeGreaterThanOrEqual(pending.serverNow!);
  expect(Number(await page.getByTestId('turn-clock').getAttribute('data-seconds'))).toBeGreaterThanOrEqual(19);
  await expect(page.locator('header [role="timer"]')).toHaveCount(0);
  await expect(page.locator('.table-center-hud [role="timer"]')).toHaveCount(0);
  await expect(page.locator('.table-seat[data-active="true"] .table-seat-token [role="timer"]')).toBeVisible();
  const pilesAfterClock=await page.locator('.table-piles').boundingBox();
  expect(pilesAfterClock!.y).toBeCloseTo(pilesBeforeClock!.y,0);expect(pilesAfterClock!.height).toBeCloseTo(pilesBeforeClock!.height,0);
  await page.screenshot({path:'artifacts/turn-clock/'+count+'-players-mobile.png'});
  const replay=await contexts[0].request.post('/api/game/'+code+'/ready',{data:{roundId:game.roundId,turnToken:game.turnToken}});expect(replay.ok()).toBe(true);expect((await replay.json()).publicState.turnDeadlineAt).toBe(started.publicState.turnDeadlineAt);
  await page.reload();await expect(page.getByTestId('turn-clock')).toBeVisible({timeout:15000});await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle');
  const reloaded:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();expect(reloaded.publicState.turnDeadlineAt).toBe(started.publicState.turnDeadlineAt);
  const urgent:GameState={...reloaded.publicState,version:reloaded.publicState.version+1,turnDeadlineAt:Date.now()+4800};
  expect((await admin.from('game_states').update({public_state:urgent,version:urgent.version,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  await expect(page.getByTestId('turn-clock')).toHaveClass(/is-urgent/);await expect(page.getByTestId('turn-clock-ring')).toHaveClass(/is-urgent/);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.table-clock-badge strong').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/turn-clock/'+count+'-players-urgent.png'});
 }finally{await Promise.allSettled(contexts.map(context=>context.close()));if(roomId)await admin.from('rooms').delete().eq('id',roomId);}
});
