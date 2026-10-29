import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(()=>vi.resetModules());afterEach(()=>vi.unstubAllGlobals());
const credentials=(id:string)=>({accessToken:'test-'+id,expiresAt:Date.now()/1000+3600,roomTopic:'room:test',playerTopic:'player:'+id,controlTopic:'control:'+id,playerId:id});
describe('Room credentials after member removal',()=>{
 it('deduplicates requests and reuses valid credentials',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>credentials('old')});vi.stubGlobal('fetch',fetcher);
  const {getRoomCredentials}=await import('./room-credentials');
  const [first,second]=await Promise.all([getRoomCredentials('ABC123'),getRoomCredentials('ABC123')]);expect(first).toEqual(second);
  await getRoomCredentials('ABC123');expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('discards old membership credentials when rejoining the same room',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>credentials('old')}).mockResolvedValueOnce({ok:true,json:async()=>credentials('new')});vi.stubGlobal('fetch',fetcher);
  const {getRoomCredentials,forgetRoomCredentials}=await import('./room-credentials');await getRoomCredentials('ABC123');forgetRoomCredentials('ABC123');
  expect((await getRoomCredentials('ABC123')).playerId).toBe('new');
 });
 it('does not let an old in-flight response overwrite a new membership',async()=>{
  let release!:(value:unknown)=>void;const delayed=new Promise(resolve=>{release=resolve;});
  const fetcher=vi.fn().mockReturnValueOnce(delayed).mockResolvedValueOnce({ok:true,json:async()=>credentials('new')});vi.stubGlobal('fetch',fetcher);
  const {getRoomCredentials,forgetRoomCredentials}=await import('./room-credentials');const old=getRoomCredentials('ABC123');forgetRoomCredentials('ABC123');
  expect((await getRoomCredentials('ABC123')).playerId).toBe('new');release({ok:true,json:async()=>credentials('old')});await old;
  expect((await getRoomCredentials('ABC123')).playerId).toBe('new');expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
