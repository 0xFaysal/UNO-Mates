import { test, expect } from '@playwright/test';

test('a guest can join another room and reconnect using the same browser session', async ({ playwright }) => {
 const hostA = await playwright.request.newContext();
 const hostB = await playwright.request.newContext();
 const guest = await playwright.request.newContext();
 try {
  const roomA = await (await hostA.post('/api/rooms/create', { data: { name: 'Host A', avatarColor: '#ef4444' } })).json();
  const roomB = await (await hostB.post('/api/rooms/create', { data: { name: 'Host B', avatarColor: '#3b82f6' } })).json();
  const join = (code: string) => guest.post('/api/rooms/join', { data: { code, name: 'CardNinja', avatarColor: '#f59e0b' } });
  expect((await join(roomA.roomCode)).ok()).toBeTruthy();
  const second = await join(roomB.roomCode);
  const payload = await second.json();
  expect(second.ok(), JSON.stringify(payload)).toBeTruthy();
  const reconnect = await join(roomB.roomCode);
  expect(reconnect.ok()).toBeTruthy();
  expect((await reconnect.json()).player.id).toBe(payload.player.id);
  const first = await (await guest.get('/api/rooms/' + roomA.roomCode)).json();
  expect(first.me.name).toBe('CardNinja');
 } finally { await hostA.dispose(); await hostB.dispose(); await guest.dispose(); }
});
