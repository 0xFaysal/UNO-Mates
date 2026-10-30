import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { canPlayCard } from '../src/lib/game/engine';
import type { Card, GameSnapshot } from '../src/lib/game/types';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
interface MotionEvent { kind: string; actor: string; move: string; at: number }
declare global { interface Window { __tableEvents: MotionEvent[]; __peakFlights: number; __lastClickAt: number } }
async function observe(page: Page) {
 await page.addInitScript(() => {
  window.__tableEvents=[];window.__peakFlights=0;window.__lastClickAt=0;
  document.addEventListener('click',()=>{window.__lastClickAt=performance.now();},true);
  new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes){
    if(node instanceof HTMLImageElement && node.dataset.flightKind){
     window.__tableEvents.push({kind:node.dataset.flightKind,actor:node.dataset.playerId||'',move:node.dataset.moveId||'',at:performance.now()});
     window.__peakFlights=Math.max(window.__peakFlights,document.querySelectorAll('.table-flying-card').length);
    }
   }
  }).observe(document,{childList:true,subtree:true});
 });
}
async function game(browser: Browser, count: number) {
 const contexts: BrowserContext[]=[];const ids:string[]=[];
 const host=await browser.newContext({reducedMotion:'no-preference'});contexts.push(host);
 const response=await host.request.post('/api/rooms/create',{data:{name:'Motion Host',avatarColor:'#ef4444'}});
 expect(response.ok()).toBeTruthy();const created=await response.json();ids.push(created.player.id);const code=created.roomCode;
 for(let i=1;i<count;i++){
  const friend=await browser.newContext();contexts.push(friend);
  const joined=await friend.request.post('/api/rooms/join',{data:{code,name:'Motion Friend '+i,avatarColor:'#3b82f6'}});expect(joined.ok()).toBeTruthy();ids.push((await joined.json()).player.id);
  expect((await friend.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBeTruthy();
 }
 expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBeTruthy();
 // Motion/rollback checks hold their initial turn; engagement.spec exercises real expiry.
 const snapshot:GameSnapshot=await(await host.request.get('/api/game/'+code)).json();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 const clock={...snapshot.publicState,turnDeadlineAt:Date.now()+180000};
 expect((await admin.from('game_states').update({version:clock.version,public_state:clock,clock_dispatch_until:null}).eq('room_id',clock.roomId)).error).toBeNull();
 return {contexts,ids,code};
}
async function playable(contexts:BrowserContext[],ids:string[],code:string) {
 for(let tries=0;tries<20;tries++){
  const base:GameSnapshot=await (await contexts[0].request.get('/api/game/'+code)).json();
  const active=base.publicState.players[base.publicState.turnIndex].id;const index=ids.indexOf(active);const context=contexts[index];
  let own:GameSnapshot=await(await context.request.get('/api/game/'+code)).json();
  if(['choose_color_wild','choose_color_draw4'].includes(own.publicState.pendingAction.type)){
   expect((await context.request.post('/api/game/'+code+'/action',{data:{action:'choose_color',color:'red'}})).ok()).toBeTruthy();
   own=await(await context.request.get('/api/game/'+code)).json();
  }
  const legal=own.myHand.find(c=>c.color!=='wild'&&canPlayCard(c,own.publicState,own.myHand.length))||own.myHand.find(c=>canPlayCard(c,own.publicState,own.myHand.length));
  if(legal)return {context,index,own,card:legal};
  expect((await context.request.post('/api/game/'+code+'/action',{data:{action:own.publicState.drawnCardPlayableId?'pass_turn':'draw_card'}})).ok()).toBeTruthy();
 }
 throw new Error('No playable turn found');
}
async function select(page:Page,card:Card){
 const button=page.locator('[data-card-id="'+card.id+'"]').getByRole('button');
 await button.scrollIntoViewIfNeeded();await button.click();
 await page.getByRole('button',{name:'Play Card',exact:true}).click();
 if(card.color==='wild')await page.getByRole('button',{name:'RED',exact:true}).click();
}

test('ten players receive seven cards one at a time, with bounded animation work',async({browser},testInfo)=>{
 test.setTimeout(150000);const {contexts,ids,code}=await game(browser,10);
 try{
  const page=await contexts[0].newPage();await observe(page);await page.goto('/game/'+code);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','deal',{timeout:25000});
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle',{timeout:10000});
  await expect(page.locator('footer [data-card-id]')).toHaveCount(7);
  const recorded=await page.evaluate(()=>({events:window.__tableEvents,peak:window.__peakFlights}));
  const deals=recorded.events.filter(e=>e.kind==='deal');expect(deals).toHaveLength(70);expect(deals.slice(0,10).map(e=>e.actor)).toEqual(ids);
  for(const id of ids)expect(deals.filter(e=>e.actor===id)).toHaveLength(7);
  expect(recorded.peak).toBeLessThanOrEqual(12);
  await page.screenshot({path:'test-results/game-dealt-'+testInfo.project.name.replaceAll(' ','-')+'.png',fullPage:true});
  const oldRound=await page.getByTestId('game-table').getAttribute('data-round-id');
  const before=deals.length;await page.emulateMedia({reducedMotion:'reduce'});
  // The host may restart a completed round, never reset a live game.
  const snapshot:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
  const final={...snapshot.publicState,status:'round_over',winnerPlayerId:ids[0],finishOrder:ids,version:snapshot.publicState.version+1};
  expect((await admin.from('game_states').update({public_state:final,status:'round_over',version:final.version}).eq('room_id',final.roomId)).error).toBeNull();
  expect((await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'restart_game'}})).ok()).toBeTruthy();
  await expect(page.getByTestId('game-table')).not.toHaveAttribute('data-round-id',oldRound!);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle');
  await expect.poll(()=>page.evaluate(()=>window.__tableEvents.filter(e=>e.kind==='deal').length)).toBe(before);
 }finally{for(const c of contexts)await c.close();}
});

test('plays and draws react before server confirmation, reconcile once, and roll back failures',async({browser},testInfo)=>{
 test.setTimeout(150000);const {contexts,ids,code}=await game(browser,2);const pages:Page[]=[];
 try{
  for(const c of contexts){const page=await c.newPage();pages.push(page);await observe(page);}
  await Promise.all(pages.map(p=>p.goto('/game/'+code)));
  for(const p of pages)await expect(p.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle',{timeout:30000});
  const first=await playable(contexts,ids,code);const page=pages[first.index];
  await page.setViewportSize({width:393,height:727});
  const readyFrame=page.locator('[data-card-id="'+first.card.id+'"] .card-action-frame');
  await expect(readyFrame).toBeVisible();await readyFrame.scrollIntoViewIfNeeded();
  const edgeTransform=()=>readyFrame.evaluate(el=>getComputedStyle(el,'::before').transform);
  const firstEdge=await edgeTransform();await expect.poll(edgeTransform).not.toBe(firstEdge);
  await page.screenshot({path:'test-results/card-ready-border.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await readyFrame.evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  let release=()=>{};const gate=new Promise<void>(r=>{release=r;});let requestId='';
  await page.route('**/api/game/'+code+'/action',async route=>{requestId=route.request().postDataJSON().requestId;await gate;await route.continue();});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/game/'+code+'/action')&&r.request().method()==='POST');
  try{
   await select(page,first.card);
   await expect(page.locator('[data-card-id="'+first.card.id+'"]')).toHaveCount(0,{timeout:300});
   await expect(page.getByTestId('top-discard')).toHaveAttribute('data-discard-card',first.card.id,{timeout:300});
   const timing=await page.evaluate(()=>({flight:window.__tableEvents.filter(e=>e.kind==='play').at(-1),click:window.__lastClickAt}));
   expect(timing.flight).toBeTruthy();expect(timing.flight!.at-timing.click).toBeLessThan(250);
  }finally{release();}
  expect((await response).ok()).toBeTruthy();await page.unroute('**/api/game/'+code+'/action');
  await expect.poll(()=>page.evaluate(id=>window.__tableEvents.filter(e=>e.kind==='play'&&e.move===id).length,requestId)).toBe(1);
  await expect(pages[1-first.index].getByTestId('top-discard')).toHaveAttribute('data-discard-card',first.card.id,{timeout:15000});
  for(let i=0;i<2;i++){
   const turn=await playable(contexts,ids,code);
   expect((await turn.context.request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:turn.card.id,...(turn.card.color==='wild'?{color:'red'}:{})}})).ok()).toBeTruthy();
  }
  await expect(page.getByTestId('previous-card')).toHaveCount(2,{timeout:15000});
  const rejection=await playable(contexts,ids,code);const rejectedPage=pages[rejection.index];
  await rejectedPage.route('**/api/game/'+code+'/action',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'That move was not saved. Try again.'})}));
  await select(rejectedPage,rejection.card);
  await expect(rejectedPage.getByRole('alert',{name:'Move error'})).toContainText('That move was not saved',{timeout:10000});
  await expect(rejectedPage.locator('[data-card-id="'+rejection.card.id+'"]')).toHaveCount(1);
  await rejectedPage.unroute('**/api/game/'+code+'/action');
  await rejectedPage.getByRole('button',{name:'Dismiss move error'}).click();
  // A deck click also moves immediately without guessing the hidden card's face.
  let actorSnapshot:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
  let drawIndex=ids.indexOf(actorSnapshot.publicState.players[actorSnapshot.publicState.turnIndex].id);
  let drawContext=contexts[drawIndex];
  let before:GameSnapshot=await(await drawContext.request.get('/api/game/'+code)).json();
  if(before.publicState.drawnCardPlayableId){
   expect((await drawContext.request.post('/api/game/'+code+'/action',{data:{action:'pass_turn'}})).ok()).toBeTruthy();
   actorSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
   drawIndex=ids.indexOf(actorSnapshot.publicState.players[actorSnapshot.publicState.turnIndex].id);drawContext=contexts[drawIndex];
   before=await(await drawContext.request.get('/api/game/'+code)).json();
  }
  const drawPage=pages[drawIndex];
  let releaseDraw=()=>{};const drawGate=new Promise<void>(r=>{releaseDraw=r;});
  await drawPage.route('**/api/game/'+code+'/action',async route=>{await drawGate;await route.continue();});
  const drawnResponse=drawPage.waitForResponse(r=>r.url().endsWith('/api/game/'+code+'/action'));
  try{await drawPage.getByTestId('draw-pile').click();await expect(drawPage.getByTestId('pending-draw')).toBeVisible({timeout:300});}finally{releaseDraw();}
  expect((await drawnResponse).ok()).toBeTruthy();await drawPage.unroute('**/api/game/'+code+'/action');
  await expect(drawPage.getByTestId('pending-draw')).toHaveCount(0);
  await expect(drawPage.locator('footer [data-card-id]')).toHaveCount(before.myHand.length+(before.publicState.drawPenalty?.amount||1));
  await page.screenshot({path:'test-results/game-history-'+testInfo.project.name.replaceAll(' ','-')+'.png',fullPage:true});
 }finally{for(const c of contexts)await c.close();}
});
