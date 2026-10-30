import {loadEnvConfig} from '@next/env';
import { test, expect } from '@playwright/test';
loadEnvConfig(process.cwd());

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

test('creating another room preserves the same browser membership in earlier rooms',async({playwright})=>{
 const host=await playwright.request.newContext(),roomIds:string[]=[];
 try{
  const create=async(name:string)=>{const response=await host.post('/api/rooms/create',{data:{name,avatarColor:'#ef4444'}});expect(response.ok()).toBe(true);const data=await response.json();roomIds.push(data.roomId);return data;};
  const first=await create('First host'),second=await create('Second host');
  const original=await host.get('/api/rooms/'+first.roomCode);expect(original.ok()).toBe(true);
  expect((await original.json()).me.id).toBe(first.player.id);
  const current=await host.get('/api/rooms/'+second.roomCode);expect(current.ok()).toBe(true);expect((await current.json()).me.id).toBe(second.player.id);
 }finally{
  // Use the already-owned request context so cleanup leaves no separate SDK HTTP pool behind.
  if(roomIds.length){const key=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!;await host.delete(process.env.NEXT_PUBLIC_SUPABASE_URL!+'/rest/v1/rooms?id=in.('+roomIds.join(',')+')',{headers:{apikey:key,Authorization:'Bearer '+key}});}
  await host.dispose();
 }
});
