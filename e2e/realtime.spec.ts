import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

test('private realtime delivers lobby, game and chat changes without polling', async ({ browser }) => {
 test.setTimeout(180000);
 const host = await browser.newContext(); const guest = await browser.newContext();
 try {
  const create = await host.request.post('/api/rooms/create', { data: { name: 'RealtimeHost', avatarColor: '#ef4444' } });
  expect(create.ok()).toBeTruthy(); const { roomCode: code } = await create.json();
  const hp = await host.newPage(); await hp.goto('/room/' + code);
  await expect(hp.getByRole('button', { name: /^Seat \d+: RealtimeHost/ })).toBeVisible({ timeout: 25000 });
  const join = await guest.request.post('/api/rooms/join', { data: { code, name: 'RealtimeGuest', avatarColor: '#3b82f6' } });
  expect(join.ok()).toBeTruthy();
  const outsider = await browser.newContext();
  expect((await outsider.request.post('/api/rooms/' + code + '/realtime')).status()).toBe(401);
  expect((await outsider.request.get('/api/rooms/' + code + '/chat')).status()).toBe(403);
  await outsider.close();
  // A second player arriving must appear on the host without an interval.
  await expect(hp.getByRole('button', { name: /^Seat \d+: RealtimeGuest/ })).toBeVisible({ timeout: 15000 });
  const gp = await guest.newPage(); await gp.goto('/room/' + code);
  await expect(gp.getByRole('button', { name: /^Seat \d+: RealtimeGuest/ })).toBeVisible({ timeout: 25000 });
  expect((await guest.request.post('/api/rooms/' + code + '/ready', { data: { isReady: true } })).ok()).toBeTruthy();
  expect((await host.request.post('/api/rooms/' + code + '/start')).ok()).toBeTruthy();
  // Transport/privacy checks hold the turn; real 20s expiry is exercised separately.
  const clockAdmin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!,{auth:{persistSession:false,autoRefreshToken:false}});
  const holdClock=async()=>{
   const snapshot=await(await host.request.get('/api/game/'+code)).json();
   const game={...snapshot.publicState,openingDealPending:false,openingNotBeforeAt:undefined,turnStartedAt:Date.now(),version:snapshot.publicState.version+1,turnDeadlineAt:Date.now()+180000,automationAt:undefined};
   expect((await clockAdmin.from('game_states').update({version:game.version,public_state:game,clock_dispatch_until:null}).eq('room_id',game.roomId).eq('version',snapshot.publicState.version)).error).toBeNull();
  };
  await holdClock();
  await expect(hp).toHaveURL('/game/' + code, { timeout: 20000 });
  await expect(gp).toHaveURL('/game/' + code, { timeout: 20000 });
  await expect(hp.locator('footer img').first()).toBeVisible({ timeout: 25000 });
  await expect(gp.locator('footer img').first()).toBeVisible({ timeout: 25000 });
  const opening = await (await host.request.get('/api/game/' + code)).json();
  if (opening.publicState.pendingAction.type === 'choose_color_wild') {
   const chooser = opening.publicState.pendingAction.playerId === opening.myPlayerId ? host : guest;
   expect((await chooser.request.post('/api/game/' + code + '/action', { data: { action: 'choose_color', color: 'red' } })).ok()).toBeTruthy();
   await expect(hp.getByRole('heading', { name: 'Choose the next color' })).toHaveCount(0);
   await holdClock();
  }
  await hp.bringToFront();
  await hp.evaluate(() => window.dispatchEvent(new Event('offline')));
  await hp.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await expect(hp.getByRole('button', { name: 'Reconnect', exact: true })).toHaveCount(0, { timeout: 20000 });
  let reads = 0;
  hp.on('request', req => { if (req.method() === 'GET' && /\/api\/(game|rooms)\//.test(req.url())) reads++; });
  // Wait for the initial post-subscribe snapshot before measuring idle traffic.
  await hp.waitForTimeout(2000); reads = 0;
  await hp.waitForTimeout(4000); expect(reads).toBe(0);
  const message = 'Live message ' + Date.now();
  expect((await guest.request.post('/api/rooms/' + code + '/chat', { data: { message } })).ok()).toBeTruthy();
  await hp.getByRole('button', {name:'Room Chat', exact:true}).click();
  await expect(hp.getByText(message, { exact: true })).toBeVisible({ timeout: 15000 });
  expect(reads).toBe(0);
  // Choose an opening wild if necessary, then draw and check the visible hand.
  const state = await (await guest.request.get('/api/game/' + code)).json();
  const hs = await (await host.request.get('/api/game/' + code)).json();
  const active = state.publicState.players[state.publicState.turnIndex].id;
  const actor = active === hs.myPlayerId ? host : guest;
  const actorPage = active === hs.myPlayerId ? hp : gp;
  if (state.publicState.pendingAction.type === 'choose_color_wild') {
   expect((await actor.request.post('/api/game/' + code + '/action', { data: { action: 'choose_color', color: 'red' } })).ok()).toBeTruthy();
  }
  const current = await (await actor.request.get('/api/game/' + code)).json();
  const before = current.myHand.length;
  expect((await actor.request.post('/api/game/' + code + '/action', { data: { action: 'draw_card' } })).ok()).toBeTruthy();
  await expect(actorPage.locator('footer img')).toHaveCount(before + (current.publicState.drawPenalty?.amount || 1), { timeout: 15000 });
  expect(reads).toBe(0);
  // Rejoining takes one authoritative snapshot and resumes broadcasts.
  await gp.reload();
  await expect(gp.locator('footer img').first()).toBeVisible({ timeout: 25000 });
  const hc = await (await host.request.post('/api/rooms/' + code + '/realtime')).json();
  const gc = await (await guest.request.post('/api/rooms/' + code + '/realtime')).json();
  const unauthorized = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  await unauthorized.realtime.setAuth(hc.accessToken);
  try {
   const forbidden = unauthorized.channel(gc.playerTopic, { config: { private: true } });
   const result = await new Promise<string>((resolve) => {
    const timeout = setTimeout(() => resolve('TIMEOUT'), 15000);
    forbidden.subscribe(status => {
     if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { clearTimeout(timeout); resolve(status); }
    });
   });
   expect(result).toBe('CHANNEL_ERROR');
  } finally { await unauthorized.removeAllChannels(); }
 } finally { await Promise.allSettled([host.close(),guest.close()]); }
});
