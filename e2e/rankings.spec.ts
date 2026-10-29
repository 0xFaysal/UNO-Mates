import { test, expect, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { createClassicDeck } from '../src/lib/game/deck';
import type { GameSnapshot } from '../src/lib/game/types';

loadEnvConfig(process.cwd());

test('all ten players rank in order, spectate, reconnect and restart', async ({ browser }, testInfo) => {
  test.setTimeout(150000);
  const contexts: BrowserContext[] = [];
  const ids: string[] = [];
  let code = '';
  try {
    for (let i = 0; i < 10; i++) {
      const context = await browser.newContext({ ...testInfo.project.use, reducedMotion: 'reduce' }); contexts.push(context);
      const response = await context.request.post(i === 0 ? '/api/rooms/create' : '/api/rooms/join', { data: { ...(i ? { code } : {}), name: 'Rank Player ' + (i + 1), avatarColor: '#ef4444' } });
      expect(response.ok()).toBeTruthy(); const data = await response.json();
      if (!i) code = data.roomCode;
      ids.push(data.player.id);
      if (i) expect((await context.request.post('/api/rooms/' + code + '/ready', { data: { isReady: true } })).ok()).toBeTruthy();
    }
    expect((await contexts[0].request.post('/api/rooms/' + code + '/start')).ok()).toBeTruthy();
    const snapshot: GameSnapshot = await (await contexts[0].request.get('/api/game/' + code)).json();
    // Seed only this newly created test room with a conserved, near-finish deck.
    // Server credentials are used only by the test runner, never a browser page.
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('This integration test needs the configured test database.');
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const deck = createClassicDeck(); const top = deck.find(c => c.id === 'red_0_0')!;
    const numbers = deck.filter(c => c.color === 'red' && /^\d$/.test(c.value) && c.value !== '0').slice(0,10);
    const hands = Object.fromEntries(ids.map((id,i) => [id,[numbers[i]]]));
    const used = new Set([top.id,...numbers.map(c => c.id)]);const drawPile = deck.filter(c => !used.has(c.id));
    const state = { ...snapshot.publicState, status: 'playing', version: snapshot.publicState.version + 1, finishOrder: [], winnerPlayerId: null, turnIndex: 0, turnDirection: 1, activeColor: 'red', topDiscard: top, discardPile: [top], recentPlays: [{ card: top, playerId: null, name: 'Opening card' }], pendingAction: { type: 'none', playerId: '' }, drawPenalty: undefined, drawnCardPlayableId: null, unoChallengeablePlayerId: null, lastMove: undefined, drawPileCount: drawPile.length, players: snapshot.publicState.players.map(p => ({ ...p, cardCount: 1 })) };
    const seeded = await admin.from('game_states').update({ public_state: state, secret_state: { drawPile, playerHands: hands }, version: state.version, status: state.status }).eq('room_id',state.roomId).eq('version',snapshot.publicState.version).select('room_id');
    expect(seeded.error).toBeNull(); expect(seeded.data).toHaveLength(1);
    const host = await contexts[0].newPage(); const friend = await contexts[1].newPage();
    await Promise.all([host.goto('/game/'+code), friend.goto('/game/'+code)]);
    await expect(host.getByTestId('game-table')).toHaveAttribute('data-table-phase','idle',{timeout:30000});
    await host.locator('[data-card-id="'+numbers[0].id+'"]').getByRole('button').click();
    const firstSaved = host.waitForResponse(r => r.url().endsWith('/api/game/'+code+'/action') && r.request().method() === 'POST');
    await host.getByRole('button',{name:'Play Card',exact:true}).click();
    expect((await firstSaved).ok()).toBeTruthy();
    await expect(host.getByTestId('finished-status')).toContainText('#1');
    await expect(host.getByRole('dialog')).toHaveCount(0);
    const afterFirst:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
    expect(afterFirst.publicState.status).toBe('playing');expect(afterFirst.publicState.finishOrder).toEqual([ids[0]]);
    expect((await contexts[0].request.post('/api/game/'+code+'/action',{data:{action:'draw_card'}})).ok()).toBeFalsy();
    await friend.locator('[data-card-id="'+numbers[1].id+'"]').getByRole('button').click();
    const secondSaved = friend.waitForResponse(r => r.url().endsWith('/api/game/'+code+'/action') && r.request().method() === 'POST');
    await friend.getByRole('button',{name:'Play Card',exact:true}).click();
    expect((await secondSaved).ok()).toBeTruthy();
    await expect(friend.getByTestId('finished-status')).toContainText('#2');
    for(let i=2;i<9;i++)expect((await contexts[i].request.post('/api/game/'+code+'/action',{data:{action:'play_card',cardId:numbers[i].id}})).ok()).toBeTruthy();
    for(const page of [host,friend]){
      await expect(page.getByRole('dialog',{name:'Final rankings'})).toBeVisible({timeout:15000});
      await expect(page.getByTestId('ranking-row')).toHaveCount(10);
      expect(await page.getByTestId('ranking-row').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-player-id')))).toEqual(ids);
    }
    await expect(friend.getByRole('button',{name:'Play Another Round'})).toHaveCount(0);
    await host.reload();await expect(host.getByRole('dialog',{name:'Final rankings'})).toBeVisible();
    await host.setViewportSize({width:320,height:568});
    expect(await host.getByRole('dialog').evaluate(el => el.scrollTop)).toBe(0);
    await host.screenshot({path:'test-results/rankings-top-'+testInfo.project.name.replaceAll(' ','-')+'.png'});
    await host.getByTestId('ranking-row').last().scrollIntoViewIfNeeded();await expect(host.getByTestId('ranking-row').last()).toBeVisible();
    await host.keyboard.press('Escape');await expect(host.getByRole('dialog')).toBeVisible();
    await host.keyboard.press('Tab');expect(await host.evaluate(()=>document.querySelector('dialog[open]')?.contains(document.activeElement))).toBe(true);
    await host.screenshot({path:'test-results/rankings-'+testInfo.project.name.replaceAll(' ','-')+'.png'});
    await host.route('**/api/game/'+code+'/action', route => route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Restart temporarily unavailable.'})}));
    await host.getByRole('button',{name:'Play Another Round'}).click();
    await expect(host.getByRole('dialog').getByRole('alert')).toHaveText('Restart temporarily unavailable.');
    await expect(host.getByRole('dialog')).toBeVisible();
    await host.unroute('**/api/game/'+code+'/action');
    const restartSaved = host.waitForResponse(r => r.url().endsWith('/api/game/'+code+'/action') && r.request().method() === 'POST');
    await host.getByRole('button',{name:'Play Another Round'}).click();
    expect((await restartSaved).ok()).toBeTruthy();
    await expect(host.getByRole('dialog')).toHaveCount(0,{timeout:15000});
    const restarted:GameSnapshot=await(await contexts[0].request.get('/api/game/'+code)).json();
    expect(restarted.publicState.finishOrder).toEqual([]);expect(restarted.publicState.winnerPlayerId).toBeNull();expect(restarted.myHand).toHaveLength(7);
  } finally { for(const context of contexts) await context.close(); }
});
