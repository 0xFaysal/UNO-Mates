import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.resetModules();vi.doUnmock('@supabase/supabase-js');});
it('retains the room identity through callback-driven connects/heartbeats and credential renewal',async()=>{
 vi.resetModules();vi.stubGlobal('window',{});vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-key');
 const setAuth=vi.fn(async()=>{});let callback:(()=>Promise<string>)|undefined;
 vi.doMock('@supabase/supabase-js',()=>({createClient:vi.fn((_url,_key,options)=>{callback=options.realtime.accessToken;return {realtime:{setAuth}};})}));
 const {getClientSupabase,setRoomRealtimeAuth}=await import('./supabase');getClientSupabase();
 await setRoomRealtimeAuth('first-room-token');expect(await callback!()).toBe('first-room-token');
 await setRoomRealtimeAuth('renewed-room-token');expect(await callback!()).toBe('renewed-room-token');expect(setAuth).toHaveBeenLastCalledWith('renewed-room-token');
});
