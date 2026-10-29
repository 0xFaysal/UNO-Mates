import { test, expect, type Browser, type BrowserContext, type TestInfo } from '@playwright/test';
async function setup(browser:Browser,testInfo:TestInfo,count=3){
 const contexts:BrowserContext[]=[];const ids:string[]=[];let code='';
 for(let i=0;i<count;i++){
  const context=await browser.newContext({...testInfo.project.use,reducedMotion:'reduce'});contexts.push(context);
  const response=await context.request.post(i?'/api/rooms/join':'/api/rooms/create',{data:{...(i?{code}:{}),name:['HostMate','OfflineMate','WatchingMate'][i],avatarColor:'#3b82f6'}});
  expect(response.ok(), 'Room setup: '+response.status()+' '+await response.text()).toBe(true);const data=await response.json();if(!i)code=data.roomCode;ids.push(data.player.id);
 }
 return {contexts,ids,code};
}

test('rename, remove offline seats and rejoin with fresh realtime membership',async({browser},testInfo)=>{
 test.setTimeout(180000);const {contexts,ids,code}=await setup(browser,testInfo);const [host,guest,watcher]=contexts;
 try{
  const hp=await host.newPage(),gp=await guest.newPage(),wp=await watcher.newPage();
  const removalEvents:string[]=[];
  wp.on('websocket',socket=>socket.on('framereceived',frame=>{const message=String(frame.payload);if(message.includes('lobby_member_removed'))removalEvents.push(message);}));
  wp.on('pageerror',error=>removalEvents.push('Page error: '+error.message));
  await Promise.all([hp.goto('/room/'+code),gp.goto('/room/'+code),wp.goto('/room/'+code)]);
  for(const page of [hp,gp,wp])await expect(page.getByTestId('seat-0')).toContainText('HostMate',{timeout:30000});
  await expect(gp.getByRole('button',{name:/^Remove /})).toHaveCount(0);
  expect((await guest.request.delete('/api/rooms/'+code+'/players/'+ids[2])).status()).toBe(403);
  expect((await host.request.delete('/api/rooms/'+code+'/players/'+ids[0])).status()).toBe(400);
  await gp.getByRole('button',{name:'Edit name',exact:true}).click();
  await gp.getByLabel('Your lobby name',{exact:true}).fill('HostMate');
  const duplicateResult=gp.waitForResponse(response=>response.url().endsWith('/profile')&&response.request().method()==='PATCH');
  await gp.getByRole('button',{name:'Save name',exact:true}).click();
  expect((await duplicateResult).status()).toBe(409);
  await expect(gp.getByRole('main').getByRole('alert')).toContainText('already taken');
  await gp.getByLabel('Your lobby name',{exact:true}).fill('Tea Ninja');
  await gp.getByRole('button',{name:'Save name',exact:true}).click();
  await expect(hp.getByTestId('seat-1')).toContainText('Tea Ninja',{timeout:15000});
  await expect(wp.getByTestId('seat-1')).toContainText('Tea Ninja',{timeout:15000});
  await gp.reload();await expect(gp.getByTestId('seat-1')).toContainText('Tea Ninja',{timeout:30000});
  expect(await gp.evaluate(()=>localStorage.getItem('uno_nickname'))).toBe('Tea Ninja');
  await gp.close();await expect(hp.getByTestId('seat-1')).toContainText('offline',{timeout:15000});
  await hp.getByRole('button',{name:'Remove Tea Ninja',exact:true}).click();
  await expect(hp.getByRole('dialog',{name:'Remove from lobby?'})).toContainText('Tea Ninja');
  await hp.keyboard.press('Escape');await expect(hp.getByTestId('seat-1')).toContainText('Tea Ninja');
  await hp.getByRole('button',{name:'Remove Tea Ninja',exact:true}).click();await hp.getByRole('button',{name:'Remove player',exact:true}).click();
  await expect(hp.getByTestId('seat-1')).toContainText('Sit here',{timeout:15000});await expect(wp.getByTestId('seat-1')).toContainText('Sit here',{timeout:15000});
  expect((await guest.request.get('/api/rooms/'+code)).status()).toBe(403);
  expect((await guest.request.patch('/api/rooms/'+code+'/profile',{data:{name:'StaleMate'}})).status()).toBe(403);
  await hp.getByRole('button',{name:'Remove WatchingMate',exact:true}).click();await hp.getByRole('button',{name:'Remove player',exact:true}).click();
  try { await expect(wp).toHaveURL('/join?code='+code+'&removed=1',{timeout:20000}); }
  catch(error) { await testInfo.attach('removal-events',{body:JSON.stringify(removalEvents),contentType:'application/json'});throw error; }
  await expect(wp.getByRole('status')).toContainText('previous seat');
  expect((await watcher.request.post('/api/rooms/'+code+'/realtime')).status()).toBe(403);
  await expect(hp.getByRole('button',{name:'Let’s play'})).toBeDisabled();
  await wp.getByLabel('Your nickname',{exact:true}).fill('Back Again');await wp.getByRole('button',{name:'Join Game Room',exact:true}).click();
  await expect(wp).toHaveURL('/room/'+code,{timeout:20000});await expect(wp.getByTestId('seat-1')).toContainText('Back Again',{timeout:30000});
  await expect(wp.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0,{timeout:20000});
  await expect(hp.getByTestId('seat-1')).toContainText('Back Again',{timeout:15000});
  const state=await(await watcher.request.get('/api/rooms/'+code)).json();expect(state.me.id).not.toBe(ids[2]);
  await wp.getByRole('button',{name:'I’m ready',exact:true}).click();
  await hp.getByRole('button',{name:'Edit name',exact:true}).click();await hp.getByLabel('Your lobby name',{exact:true}).fill('Night Host');await hp.getByRole('button',{name:'Save name',exact:true}).click();
  await expect(wp.getByTestId('seat-0')).toContainText('Night Host',{timeout:15000});
  await hp.getByRole('button',{name:'Let’s play'}).click();await expect(hp).toHaveURL('/game/'+code,{timeout:20000});
  expect((await host.request.delete('/api/rooms/'+code+'/players/'+state.me.id)).status()).toBe(409);
  expect((await watcher.request.patch('/api/rooms/'+code+'/profile',{data:{name:'Too Late'}})).status()).toBe(409);
  const game=await(await host.request.get('/api/game/'+code)).json();expect(game.publicState.players.map((p:{name:string})=>p.name)).toEqual(['Night Host','Back Again']);
 }finally{for(const context of contexts)await context.close();}
});

test('start races cannot publish a removed member or a stale name',async({browser},testInfo)=>{
 test.setTimeout(90000);const {contexts,ids,code}=await setup(browser,testInfo,2);const [host,guest]=contexts;
 try{
  expect((await guest.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBe(true);
  const [rename,start]=await Promise.all([
   guest.request.patch('/api/rooms/'+code+'/profile',{data:{name:'Race Mate'}}),host.request.post('/api/rooms/'+code+'/start'),
  ]);
  expect(rename.ok()||start.ok()).toBe(true);
  if(!start.ok())expect((await host.request.post('/api/rooms/'+code+'/start')).ok()).toBe(true);
  const game=await(await host.request.get('/api/game/'+code)).json();const room=await(await guest.request.get('/api/rooms/'+code)).json();
  expect(game.publicState.players.find((p:{id:string})=>p.id===ids[1]).name).toBe(room.me.name);
  expect((await host.request.delete('/api/rooms/'+code+'/players/'+ids[1])).status()).toBe(409);
 }finally{for(const context of contexts)await context.close();}
});
