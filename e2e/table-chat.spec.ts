import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {loadEnvConfig} from '@next/env';
loadEnvConfig(process.cwd());

test('table talk previews fly into chat, respect reduced motion, and preserve failed drafts',async({browser},testInfo)=>{
 test.setTimeout(150000);
 const host=await browser.newContext({...testInfo.project.use,reducedMotion:'no-preference'}),guest=await browser.newContext({...testInfo.project.use});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
 let roomId:string|undefined;
 try{
  const created=await(await host.request.post('/api/rooms/create',{data:{name:'CardNinja',avatarColor:'#f59e0b'}})).json();roomId=created.roomId;const code=created.roomCode;
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'আমের রাজা',avatarColor:'#3b82f6'}})).ok()).toBe(true);
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial=await(await host.request.get('/api/game/'+code)).json();
  const state={...initial.publicState,version:initial.publicState.version+1,roundStartedAt:Date.now()-60000,openingDealPending:false,turnStartedAt:Date.now()-1000,turnDeadlineAt:Date.now()+300000,automationAt:undefined,pendingAction:{type:'none',playerId:''}};
  expect((await db.from('game_states').update({version:state.version,public_state:state,clock_dispatch_until:null}).eq('room_id',roomId)).error).toBeNull();
  const page=await host.newPage();await page.goto('/game/'+code);await expect(page.locator('[data-table-phase="idle"]')).toBeVisible({timeout:30000});
  const chat=page.getByRole('button',{name:'Room Chat',exact:true});await chat.click();
  const dialog=page.getByRole('dialog',{name:'Room chat',exact:true});await expect(dialog.getByRole('heading',{name:'A little table talk?'})).toBeVisible();
  await expect(dialog.getByLabel('Message',{exact:true})).toBeInViewport();
  await page.screenshot({path:'artifacts/chat/empty-'+testInfo.project.name+'.png'});
  await page.keyboard.press('Escape');await expect(chat).toBeFocused();
  const incoming='এবার কিন্তু +4 আসছে! 🃏';
  expect((await guest.request.post('/api/rooms/'+code+'/chat',{data:{message:incoming}})).ok()).toBe(true);
  const preview=page.getByTestId('table-chat-preview');await expect(preview).toContainText(incoming,{timeout:10000});
  await expect(chat).toHaveAttribute('title','Room Chat · 1 unread');
  const geometry=await preview.boundingBox(),dock=await page.locator('.table-hand-dock').boundingBox();expect(geometry!.y+geometry!.height).toBeLessThanOrEqual(dock!.y);
  await page.screenshot({path:'artifacts/chat/preview-'+testInfo.project.name+'.png'});
  await expect(preview).toHaveAttribute('data-phase','flying',{timeout:6000});
  const flight=await preview.evaluate(el=>{const animation=el.getAnimations().find(a=>a instanceof Animation&&(a.effect as KeyframeEffect)?.getKeyframes().length===3);return (animation?.effect as KeyframeEffect)?.getKeyframes().at(-1)?.transform;});expect(flight).toContain('scale(0.05)');
  await expect(preview).toHaveCount(0);await chat.click();await expect(dialog.getByText(incoming,{exact:true})).toBeVisible();await expect(chat).toHaveAttribute('title','Room Chat');
  const input=dialog.getByLabel('Message',{exact:true});await input.fill('Nice move — rematch?');
  await page.route('**/api/rooms/*/chat',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:'Message not sent. Please try again.'}}):route.continue());
  await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Message not sent');await expect(input).toHaveValue('Nice move — rematch?');
  await page.unroute('**/api/rooms/*/chat');await dialog.getByRole('button',{name:'Send message',exact:true}).click();await expect(input).toHaveValue('');await expect(dialog.getByText('Nice move — rematch?',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Send Fire reaction'}).click();await expect(dialog.locator('.talk-bubble.is-emoji').filter({hasText:'🔥'})).toBeVisible();
  await page.screenshot({path:'artifacts/chat/conversation-'+testInfo.project.name+'.png'});
  await page.keyboard.press('Escape');await expect(preview).toHaveCount(0);await expect(chat).toHaveAttribute('title','Room Chat');
  await page.reload();await expect(page.getByTestId('game-table')).toBeVisible();await expect(preview).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  expect((await guest.request.post('/api/rooms/'+code+'/chat',{data:{message:'Good game!'}})).ok()).toBe(true);await expect(preview).toContainText('Good game!');
  await preview.click();await expect(dialog).toBeVisible();await expect(preview).toHaveCount(0);await expect(dialog.getByText('Good game!',{exact:true})).toBeVisible();
  const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.setViewportSize({width:320,height:520});await expect(dialog.getByLabel('Message',{exact:true})).toBeInViewport();await expect(dialog.getByRole('button',{name:'Send Fire reaction'})).toBeInViewport();
  await page.keyboard.press('Escape');
  expect((await guest.request.post('/api/rooms/'+code+'/chat',{data:{message:'One more round?'}})).ok()).toBe(true);await expect(preview).toContainText('One more round?');
  const moves=await preview.evaluate(el=>new Promise<boolean>((resolve,reject)=>{
   const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Reduced-motion fade did not start'));},6000);
   const observer=new MutationObserver(()=>{if((el as HTMLElement).dataset.phase!=='flying')return;clearTimeout(timer);observer.disconnect();resolve(el.getAnimations().flatMap(a=>(a.effect as KeyframeEffect).getKeyframes()).some(frame=>Boolean(frame.transform)&&frame.transform!=='none'));});observer.observe(el,{attributes:true,attributeFilter:['data-phase']});
  }));expect(moves).toBe(false);await expect(preview).toHaveCount(0);
 }finally{await host.close();await guest.close();if(roomId)expect((await db.from('rooms').delete().eq('id',roomId)).error).toBeNull();}
});
