import type { Card } from '../src/lib/game/types';
import { test, expect } from '@playwright/test';

test.describe('Real-Time Multiplayer UNO E2E Flow', () => {
  test('Home page displays polished UI and loads properly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('UNO Mates');
    await expect(page.getByText('Create Private Room')).toBeVisible();
    await expect(page.getByPlaceholder('6-LETTER CODE')).toBeVisible();
    // Content checks alone do not catch a missing Tailwind build.
    await expect(page.locator('header')).toHaveCSS('display', 'grid');
    await expect(page.locator('h1')).toHaveCSS('font-weight', '900');
    await expect(page.locator('main')).toHaveCSS('max-width', '448px');
    await expect(page.locator('h1')).toHaveCSS('font-size', /^(42|60)px$/);
  });

  test('Rules page displays custom house rules', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.locator('h1')).toContainText('UNO Mates house rules');
    await expect(page.getByText('Stacking +2 and +4')).toBeVisible();
  });

  test('Multiplayer 4-Player Simulation with Independent Player Sessions', async ({ playwright }) => {
    // 1. Host creates a dedicated request context (with isolated cookies)
    const hostContext = await playwright.request.newContext();
    const createRes = await hostContext.post('http://localhost:3000/api/rooms/create', {
      data: { name: 'Player1_Host', avatarColor: '#ef4444' },
    });
    expect(createRes.ok()).toBeTruthy();
    const { roomCode, player: hostPlayer } = await createRes.json();
    expect(roomCode).toHaveLength(6);

    // 2. Three other players join with their own independent request contexts
    const friends = [
      { name: 'Player2_Bob', color: '#3b82f6' },
      { name: 'Player3_Charlie', color: '#10b981' },
      { name: 'Player4_Diana', color: '#f59e0b' },
    ];

    const friendContexts = [];
    for (const friend of friends) {
      const friendContext = await playwright.request.newContext();
      friendContexts.push(friendContext);

      const joinRes = await friendContext.post('http://localhost:3000/api/rooms/join', {
        data: { code: roomCode, name: friend.name, avatarColor: friend.color },
      });
      expect(joinRes.ok()).toBeTruthy();

      // Mark ready
      const readyRes = await friendContext.post(`http://localhost:3000/api/rooms/${roomCode}/ready`, {
        data: { isReady: true },
      });
      expect(readyRes.ok()).toBeTruthy();
    }

    // 3. Host starts game using hostContext (strictly authorized)
    const startRes = await hostContext.post(`http://localhost:3000/api/rooms/${roomCode}/start`);
    expect(startRes.ok()).toBeTruthy();
    const startData = await startRes.json();
    expect(startData.gameStarted).toBe(true);

    // 4. Verify room details endpoint shows status 'playing'
    const roomStateRes = await hostContext.get(`http://localhost:3000/api/rooms/${roomCode}`);
    const roomData = await roomStateRes.json();
    expect(roomData.room.status).toBe('playing');
    expect(roomData.players).toHaveLength(4);

    // 5. Verify game state endpoint returns private hand for host
    const gameStateRes = await hostContext.get(`http://localhost:3000/api/game/${roomCode}`);
    const gameStateData = await gameStateRes.json();
    expect(gameStateData.publicState.status).toBe('playing');
    expect(gameStateData.myHand.length).toBeGreaterThanOrEqual(7);

    // 6. Verify confidentiality: friend 1's private hand is isolated
    const friend1StateRes = await friendContexts[0].get(`http://localhost:3000/api/game/${roomCode}`);
    const friend1Data = await friend1StateRes.json();
    expect(friend1Data.myHand.length).toBeGreaterThanOrEqual(7);
    expect(friend1Data.myPlayerId).not.toBe(hostPlayer.id);

    // Verify host hand and friend hand are private distinct arrays
    const hostHandIds = gameStateData.myHand.map((c: Card) => c.id);
    const friend1HandIds = friend1Data.myHand.map((c: Card) => c.id);
    for (const cardId of hostHandIds) {
      expect(friend1HandIds).not.toContain(cardId);
    }
  });
});
