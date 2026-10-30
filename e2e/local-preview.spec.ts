import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());
test('a phone-sized browser retains its room session over local HTTP preview',async({page,baseURL,browser})=>{
 test.setTimeout(90000);let roomId='';const guest=await browser.newContext();
 const origin=process.env.UNO_TEST_LAN_ORIGIN||baseURL!;
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  await page.setViewportSize({width:393,height:727});await page.goto(origin);
  await page.getByLabel('Your nickname',{exact:true}).fill('LAN Mate');
  const created=page.waitForResponse(r=>r.url().endsWith('/api/rooms/create')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create Private Room',exact:true}).click();const response=await created;expect(response.ok()).toBe(true);const room=await response.json();roomId=room.roomId;
  await expect(page).toHaveURL(origin+'/room/'+room.roomCode,{timeout:15000});
  await expect(page.getByRole('button',{name:/^Seat \d+: LAN Mate/})).toBeVisible({timeout:15000});
  expect((await page.request.get(origin+'/api/rooms/'+room.roomCode)).ok()).toBe(true);
  if(process.env.UNO_TEST_LAN_ORIGIN){const cookie=(await page.context().cookies(origin)).find(c=>c.name==='uno_guest_session');expect(cookie).toMatchObject({httpOnly:true,secure:false,sameSite:'Lax'});}
  await page.reload();await expect(page.getByRole('button',{name:/^Seat \d+: LAN Mate/})).toBeVisible({timeout:15000});
  await page.getByRole('button',{name:'Copy room code '+room.roomCode}).click();
  await expect(page.getByText('Copied. Send it to your favourite troublemakers.')).toBeVisible();
  expect((await guest.request.post(origin+'/api/rooms/join',{data:{code:room.roomCode,name:'LAN Guest',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post(origin+'/api/rooms/'+room.roomCode+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await page.request.post(origin+'/api/rooms/'+room.roomCode+'/start')).ok()).toBe(true);
  const snapshot=await(await page.request.get(origin+'/api/game/'+room.roomCode)).json();
  const card=snapshot.myHand.find((card:{value:string})=>/^\d$/.test(card.value));expect(card).toBeTruthy();
  const game={...snapshot.publicState,version:snapshot.publicState.version+1,openingDealPending:false,openingNotBeforeAt:null,turnStartedAt:Date.now(),turnDeadlineAt:Date.now()+180000,automationAt:null,turnIndex:snapshot.publicState.players.findIndex((p:{id:string})=>p.id===snapshot.myPlayerId),activeColor:card.color,drawPenalty:null,pendingAction:{type:'none',playerId:''}};
  expect((await admin.from('game_states').update({public_state:game,version:game.version,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  await page.goto(origin+'/game/'+room.roomCode);await expect(page.locator('[data-card-id="'+card.id+'"] button')).toBeEnabled({timeout:20000});
  const played=page.waitForResponse(r=>r.url().endsWith('/api/game/'+room.roomCode+'/action'));
  await page.locator('[data-card-id="'+card.id+'"] button').click();await page.getByRole('button',{name:'Play Card',exact:true}).click();
  expect((await played).ok()).toBe(true);await expect(page.getByTestId('top-discard')).toHaveAttribute('data-discard-card',card.id);
  await page.screenshot({path:'artifacts/audit/lan-preview.png'});
 }finally{await guest.close();if(roomId)await admin.from('rooms').delete().eq('id',roomId);}
});
