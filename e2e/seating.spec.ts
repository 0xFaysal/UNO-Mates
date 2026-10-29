import { test, expect, type BrowserContext } from '@playwright/test';

test('ten-seat lounge supports live moves, swaps and mobile turn order', async ({ browser }, testInfo) => {
 test.setTimeout(150000);
 const contexts: BrowserContext[] = [];
 const host = await browser.newContext(); contexts.push(host);
 try {
  const cr = await host.request.post('/api/rooms/create',{data:{name:'Player',avatarColor:'#ef4444'}});
  expect(cr.ok()).toBeTruthy(); const { roomCode: code, player: hostPlayer } = await cr.json();
  const guest = await browser.newContext(); contexts.push(guest);
  const jr=await guest.request.post('/api/rooms/join',{data:{code,name:'Player',avatarColor:'#3b82f6'}});
  expect(jr.ok()).toBeTruthy(); const { player: guestPlayer }=await jr.json();
  const hp=await host.newPage(); const gp=await guest.newPage();
  await hp.goto('/room/'+code); await gp.goto('/room/'+code);
  await expect(hp.getByText('Pull up a chair.',{exact:true})).toBeVisible({timeout:25000});
  await expect(gp.getByText('Pull up a chair.',{exact:true})).toBeVisible({timeout:25000});
  await hp.getByTestId('seat-7').click();
  await expect(gp.getByTestId('seat-7')).toContainText(hostPlayer.name,{timeout:15000});
  await hp.getByTestId('seat-1').click();
  await expect(hp.getByRole('region',{name:'Confirm seat swap'})).toBeVisible();
  await hp.getByRole('button',{name:'Swap seats',exact:true}).click();
  await expect(gp.getByTestId('seat-1')).toContainText(hostPlayer.name,{timeout:15000});
  await expect(gp.getByTestId('seat-7')).toContainText(guestPlayer.name);
  for(let i=0;i<8;i++){
   const friend=await browser.newContext();contexts.push(friend);
   const joined=await friend.request.post('/api/rooms/join',{data:{code,name:'Player',avatarColor:['#8b5cf6','#ec4899','#06b6d4','#f97316'][i%4]}});
   expect(joined.ok()).toBeTruthy();
  }
  await expect(hp.locator('.lounge-seat.is-filled')).toHaveCount(10,{timeout:20000});
  const room=await (await host.request.get('/api/rooms/'+code)).json();
  expect(new Set(room.players.map((p:{name:string})=>p.name)).size).toBe(10);
  const original=hp.viewportSize()!;
  for(const width of [320,390,430]){
   await hp.setViewportSize({width,height:844});
   const dimensions=await hp.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
   const seats=await hp.locator('.lounge-seat').all();
   for(const seat of seats){const box=(await seat.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(box.width).toBeGreaterThanOrEqual(44);}
  }
  await hp.setViewportSize(original);
  await hp.locator('.lounge-main').evaluate(el => { el.scrollTop = 0; });
  await hp.screenshot({path:'test-results/lounge-'+testInfo.project.name.replaceAll(' ','-')+'.png',fullPage:true});
  for(const friend of contexts.slice(1)) expect((await friend.request.post('/api/rooms/'+code+'/ready',{data:{isReady:true}})).ok()).toBeTruthy();
  await expect(hp.getByRole('button',{name:'Let’s play'})).toBeEnabled({timeout:20000});
  await hp.getByRole('button',{name:'Let’s play'}).click();
  await expect(hp).toHaveURL('/game/'+code,{timeout:20000});
  const game=await (await host.request.get('/api/game/'+code)).json();
  expect(game.publicState.players.map((p:{id:string})=>p.id)).toEqual(room.players.map((p:{id:string})=>p.id));
  const locked=await host.request.post('/api/rooms/'+code+'/seat',{data:{seatIndex:3,expectedOccupantId:null}});
  expect(locked.status()).toBe(409);
 } finally {for(const ctx of contexts) await ctx.close();}
});
