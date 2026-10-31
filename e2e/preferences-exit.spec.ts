import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());

test('message previews are personal and persistent; exiting always needs confirmation',async({browser},testInfo)=>{
 test.setTimeout(150000);
 const host=await browser.newContext({...testInfo.project.use}),guest=await browser.newContext({...testInfo.project.use});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId:string|undefined;
 try{
  const created=await(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#f59e0b'}})).json();roomId=created.roomId;const code=created.roomCode;
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'TableMate',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial=await(await host.request.get('/api/game/'+code)).json();
  const state={...initial.publicState,version:initial.publicState.version+1,roundStartedAt:Date.now()-60000,openingDealPending:false,turnStartedAt:Date.now()-1000,turnDeadlineAt:Date.now()+300000,automationAt:undefined,pendingAction:{type:'none',playerId:''}};
  expect((await db.from('game_states').update({version:state.version,public_state:state,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  const page=await host.newPage(),other=await guest.newPage();await other.goto('/game/'+code);await page.goto('/game/'+code);
  await expect(page.locator('[data-table-phase="idle"]')).toBeVisible({timeout:30000});
  const settings=page.getByRole('dialog',{name:'Sound & feedback',exact:true});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const toggle=settings.getByRole('switch',{name:'Message previews',exact:true});await expect(toggle).toBeChecked();await toggle.uncheck();await page.keyboard.press('Escape');
  const send=async(message:string)=>expect((await guest.request.post('/api/rooms/'+code+'/chat',{data:{message}})).ok()).toBe(true);
  await send('Hidden preview, saved chat');
  const chat=page.getByRole('button',{name:'Room Chat',exact:true}),preview=page.getByTestId('table-chat-preview');
  await expect(chat).toHaveAttribute('title','Room Chat · 1 unread',{timeout:15000});await expect(preview).toHaveCount(0);
  await chat.click();await expect(page.getByRole('dialog',{name:'Room chat',exact:true}).getByText('Hidden preview, saved chat',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.reload();await expect(page.getByTestId('game-table')).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(toggle).not.toBeChecked();await toggle.check();await page.keyboard.press('Escape');await expect(preview).toHaveCount(0);
  await send('New previews are back');await expect(preview).toContainText('New previews are back');
  await other.getByRole('button',{name:'Settings',exact:true}).click();await expect(other.getByRole('switch',{name:'Message previews',exact:true})).toBeChecked();await other.keyboard.press('Escape');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await settings.getByRole('button',{name:'Exit game',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'Leave the game?',exact:true});await expect(confirmation).toBeVisible();await expect(confirmation.getByRole('button',{name:'Keep playing'})).toBeFocused();
  await page.screenshot({path:'artifacts/preferences/exit-'+testInfo.project.name+'.png'});
  await page.keyboard.press('Escape');await expect(confirmation).not.toBeVisible();await expect(settings).toBeVisible();await expect(page).toHaveURL(new RegExp('/game/'+code+'$'));
  await settings.getByRole('button',{name:'Exit game',exact:true}).click();await confirmation.getByRole('button',{name:'Keep playing'}).click();await expect(confirmation).not.toBeVisible();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Exit game',exact:true}).click();await expect(confirmation).toBeVisible();await confirmation.getByRole('button',{name:'Exit game',exact:true}).click();await expect(page).toHaveURL('/');await expect(other.getByTestId('game-table')).toBeVisible();
 }finally{await host.close();await guest.close();if(roomId)expect((await db.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
