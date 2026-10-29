import { test, expect } from '@playwright/test';

test('brand, labelled controls and storage-blocked room entry work on a small screen',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('Storage blocked');}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('Storage blocked');}});});
 let requests=0;let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/rooms/create',async route=>{requests++;await gate;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Could not create the room. Try again.'})});});
 await page.goto('/');await expect(page).toHaveTitle(/UNO Mates/);await expect(page.getByRole('heading',{name:'UNO Mates',exact:true})).toBeVisible();
 await expect(page.getByLabel('Your nickname',{exact:true})).not.toHaveValue('');
 await expect(page.getByRole('button',{name:/Avatar color:/})).toHaveCount(8);
 await page.getByRole('button',{name:'Avatar color: Amber'}).click();await expect(page.getByRole('button',{name:'Avatar color: Amber'})).toHaveAttribute('aria-pressed','true');
 const before=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);expect(before).toBe(true);
 try{await page.getByRole('button',{name:'Create Private Room'}).click();await expect(page.getByRole('button',{name:'Join Room',exact:true})).toBeDisabled();await expect.poll(()=>requests).toBe(1);}finally{release();}
 await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not create the room. Try again.');await expect(page.getByRole('button',{name:'Create Private Room'})).toBeEnabled();
 for(const asset of ['/favicon.ico','/icon.png','/apple-icon.png']){const response=await page.request.get(asset);expect(response.ok()).toBe(true);expect((await response.body()).byteLength).toBeGreaterThan(100);}
});

test('sound preference survives reload',async({page})=>{
 await page.goto('/settings');const toggle=page.getByRole('switch',{name:'Sound effects',exact:true});await expect(toggle).toBeChecked();await toggle.uncheck();await page.reload();await expect(page.getByRole('switch',{name:'Sound effects',exact:true})).not.toBeChecked();
});

test('game dialogs contain focus and failed chat sends retain the draft',async({browser})=>{
 test.setTimeout(90000);const host=await browser.newContext({reducedMotion:'reduce'});const guest=await browser.newContext({reducedMotion:'reduce'});
 try{
  const created=await(await host.request.post('/api/rooms/create',{data:{name:'AuditHost',avatarColor:'#f59e0b'}})).json();const code=created.roomCode;
  expect((await guest.request.post('/api/rooms/join',{data:{code,name:'AuditMate',avatarColor:'#3b82f6'}})).ok()).toBe(true);expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const initial=await(await host.request.get('/api/game/'+code)).json();if(initial.publicState.pendingAction.type==='choose_color_wild')expect((await host.request.post('/api/game/'+code+'/action',{data:{action:'choose_color',color:'red'}})).ok()).toBe(true);
  const page=await host.newPage();await page.goto('/game/'+code);await expect(page.getByTestId('game-table')).toBeVisible({timeout:30000});
  for(const [button,title] of [['Settings','Sound & feedback'],['Rules','House rules']]){
   await page.getByRole('button',{name:button,exact:true}).click();const dialog=page.getByRole('dialog',{name:title});await expect(dialog).toBeVisible();await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button',{name:'Room Chat',exact:true}).click();const dialog=page.getByRole('dialog',{name:/Room chat/});await expect(dialog).toBeVisible();
  await page.route('**/api/rooms/'+code+'/chat',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Message not sent. Try again.'})}):route.continue());
  const input=page.getByLabel('Message',{exact:true});await input.fill('Keep this draft');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveText('Message not sent. Try again.');await expect(input).toHaveValue('Keep this draft');
  await page.unroute('**/api/rooms/'+code+'/chat');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(input).toHaveValue('');await expect(page.getByText('Keep this draft',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Room Chat',exact:true})).toBeFocused();
 }finally{await host.close();await guest.close();}
});

test('an expired room session returns to the invitation form',async({page})=>{await page.goto('/game/ABC123');await expect(page).toHaveURL('/join?code=ABC123',{timeout:30000});await expect(page.getByLabel('Room code',{exact:true})).toHaveValue('ABC123');});
