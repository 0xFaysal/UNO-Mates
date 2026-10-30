import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const create=vi.hoisted(()=>vi.fn());
vi.mock('@supabase/supabase-js',()=>({createClient:create}));
beforeEach(()=>{vi.resetModules();create.mockReset();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_SECRET_KEY','test-only-server-key');});
afterEach(()=>vi.unstubAllEnvs());
it('reuses a stateless server client and replaces it when credentials change',async()=>{
 create.mockImplementation(()=>({from:vi.fn()}));const store=await import('./store');
 expect(store.getSupabaseClient()).toBe(store.getSupabaseClient());expect(create).toHaveBeenCalledTimes(1);
 vi.stubEnv('SUPABASE_SECRET_KEY','rotated-test-key');expect(store.getSupabaseClient()).not.toBe(create.mock.results[0].value);expect(create).toHaveBeenCalledTimes(2);
});
it('does not retain database rooms, player sessions, chat or full decks in fallback maps',async()=>{
 const player={id:'p',room_id:'r',session_token:'private-session',name:'Mate',avatar_color:'#ef4444',seat_index:0,is_host:true,is_ready:true,is_online:true,last_seen_at:new Date().toISOString(),created_at:new Date().toISOString()};
 const room={id:'r',code:'MEMORY',host_player_id:'p',status:'lobby',max_players:10,created_at:player.created_at,updated_at:player.created_at};
 const builder={select:vi.fn(),eq:vi.fn(),order:vi.fn(),single:vi.fn(),update:vi.fn(),insert:vi.fn(),throwOnError:vi.fn()};
 for(const key of ['select','eq','update','insert'] as const)builder[key].mockReturnValue(builder);
 builder.order.mockResolvedValue({data:[player]});builder.single.mockResolvedValue({data:room});builder.throwOnError.mockResolvedValue({});
 create.mockReturnValue({from:()=>builder});const store=await import('./store');
 const sizes=()=>[global.__uno_rooms?.size,global.__uno_players?.size,global.__uno_game_states?.size,global.__uno_chat?.size];const before=sizes();
 await store.getRoomByCode('MEMORY');await store.getPlayersInRoom('r');await store.addChatMessage('r','p','Mate','#ef4444','hello');
 builder.single.mockResolvedValue({data:{public_state:{},secret_state:{drawPile:[],playerHands:{}}}});await store.getAuthoritativeState('r');
 expect(sizes()).toEqual(before);
 builder.single.mockResolvedValue({data:player});expect((await store.setPlayerReady('p',true)).id).toBe('p');
});
