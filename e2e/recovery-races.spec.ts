import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
test('lobby transition survives an older in-flight game recovery response',async({browser})=>{
 test.setTimeout(60000);const host=await browser.newContext(),guest=await browser.newContext();let roomId='';
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let release=()=>{};
 try{
  const create=await host.request.post('/api/rooms/create',{data:{name:'Race Host',avatarColor:'#ef4444'}});expect(create.ok()).toBe(true);const {roomCode:code}=await create.json();
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'Race Guest',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const snapshot=await(await host.request.get('/api/game/'+code)).json();roomId=snapshot.publicState.roomId;
  const final={...snapshot.publicState,status:'round_over',version:snapshot.publicState.version+1,openingDealPending:false,turnDeadlineAt:null,automationAt:null,winnerPlayerId:snapshot.publicState.players[0].id,finishOrder:snapshot.publicState.players.map((p:{id:string})=>p.id)};
  expect((await admin.from('game_states').update({status:'round_over',public_state:final,version:final.version}).eq('room_id',roomId)).error).toBeNull();
  const page=await guest.newPage();await page.goto('/game/'+code);await expect(page.getByRole('dialog',{name:'Final rankings'})).toBeVisible({timeout:25000});
  let captured=()=>{};const capture=new Promise<void>(resolve=>{captured=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});let first=true;
  await page.route('**/api/game/'+code,async route=>{
   if(!first){await route.continue();return;}first=false;
   const old=await route.fetch();captured();await gate;await route.fulfill({response:old});
  });
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));await capture;
  expect((await host.request.post('/api/rooms/'+code+'/return-to-lobby',{data:{version:final.version,roundId:final.roundId}})).ok()).toBe(true);
  await page.waitForTimeout(800);release();
  await expect(page).toHaveURL('/room/'+code,{timeout:10000});
 }finally{release();await Promise.allSettled([host.close(),guest.close()]);if(roomId)await admin.from('rooms').delete().eq('id',roomId);}
});
