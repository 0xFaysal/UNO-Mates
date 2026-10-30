import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());

test('slow mobile connection stays playable, coalesces recovery and releases old state',async({browser},testInfo)=>{
 test.setTimeout(180000);
 const host=await browser.newContext({viewport:{width:393,height:727},reducedMotion:'no-preference'}),guest=await browser.newContext();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId='';
 try{
  const created=await host.request.post('/api/rooms/create',{data:{name:'Smooth Host',avatarColor:'#ef4444'}});expect(created.ok()).toBe(true);const {roomCode:code}=await created.json();
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'Smooth Mate',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const opening=await(await host.request.get('/api/game/'+code)).json();roomId=opening.publicState.roomId;
  const card=opening.myHand.find((card:{value:string})=>/^\d$/.test(card.value));expect(card).toBeTruthy();
  const game={...opening.publicState,version:opening.publicState.version+1,turnIndex:opening.publicState.players.findIndex((player:{id:string})=>player.id===opening.myPlayerId),activeColor:card.color,drawPenalty:null,pendingAction:{type:'none',playerId:''},openingDealPending:false,openingNotBeforeAt:null,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:null};
  expect((await admin.from('game_states').update({version:game.version,public_state:game,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  const page=await host.newPage(),cdp=await host.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Performance.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:250,downloadThroughput:40*1024,uploadThroughput:20*1024});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  let transferred=0;cdp.on('Network.loadingFinished',event=>{transferred+=event.encodedDataLength;});
  await page.goto('/game/'+code);await expect(page.getByTestId('game-table')).toBeVisible({timeout:45000});
  await expect(page.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0,{timeout:30000});
  await expect(page.locator('footer [data-card-id]')).toHaveCount(7);
  await expect(page.locator('[data-card-id="'+card.id+'"] button')).toBeEnabled();
  const bytesToTable=transferred;
  const metrics=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');return Object.fromEntries(metrics.map(metric=>[metric.name,metric.value]));};
  await cdp.send('HeapProfiler.collectGarbage');const initial=await metrics();
  const reads:string[]=[];page.on('request',request=>{if(request.method()==='GET'&&/\/api\/(game|rooms)\//.test(request.url()))reads.push(request.url());});
  await page.waitForTimeout(1200);reads.length=0;await page.waitForTimeout(3000);expect(reads).toHaveLength(0);
  await page.route('**/api/game/'+code,async route=>{await new Promise(resolve=>setTimeout(resolve,1800));await route.continue();});
  for(let batch=0;batch<3;batch++){
   await page.evaluate(()=>{for(let i=0;i<12;i++)window.dispatchEvent(new Event('online'));});
   await page.waitForTimeout(350);
  }
  await page.waitForTimeout(2500);
  expect(reads.filter(url=>url.endsWith('/api/game/'+code))).toHaveLength(1);
  await page.unroute('**/api/game/'+code);
  const beforePlay=await page.locator('[data-card-id="'+card.id+'"] img').boundingBox();expect(beforePlay).toBeTruthy();
  await page.locator('[data-card-id="'+card.id+'"] button').click();await page.getByRole('button',{name:'Play Card',exact:true}).click();
  await expect(page.locator('[data-card-id="'+card.id+'"]')).toHaveCount(0,{timeout:1000});
  await expect(page.getByTestId('top-discard')).toHaveAttribute('data-discard-card',card.id);
  await expect.poll(async()=>(await(await host.request.get('/api/game/'+code)).json()).publicState.topDiscard.id).toBe(card.id);
  await page.waitForTimeout(1000);await expect(page.locator('.table-flying-card')).toHaveCount(0);
  await host.setOffline(true);await expect(page.getByText('Offline. Live updates resume when your connection returns.',{exact:false})).toBeVisible();
  await expect(page.getByTestId('game-table')).toBeVisible();await host.setOffline(false);
  await expect(page.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0,{timeout:30000});
  // Exercise dialog lifecycle and ensure its private state is not accumulating in detached nodes.
  for(let i=0;i<4;i++){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Close settings'}).click();}
  await cdp.send('HeapProfiler.collectGarbage');const final=await metrics();
  expect(final.JSHeapUsedSize-initial.JSHeapUsedSize).toBeLessThan(20*1024*1024);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const assets=await host.request.get('/cards/card_back.svg');expect(assets.headers()['cache-control']).toContain('max-age=86400');
  await testInfo.attach('mobile-performance',{body:JSON.stringify({network:'250ms RTT, 40KiB/s down, 20KiB/s up',cpuSlowdown:4,bytesToTable,initial,final},null,2),contentType:'application/json'});
  await page.screenshot({path:'artifacts/performance/mobile.png'});
 }finally{await host.setOffline(false);await Promise.allSettled([host.close(),guest.close()]);if(roomId)await admin.from('rooms').delete().eq('id',roomId);}
});
