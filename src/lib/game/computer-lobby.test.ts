import {it,expect,vi,afterEach} from 'vitest';
import {createRoom,joinRoom,getPlayersInRoom,getPlayerBySession,startGameInRoom,saveAuthoritativeState,returnRoomToLobby} from '../server/store';
import {addComputerPlayer} from '../server/computer-players';
afterEach(()=>vi.unstubAllEnvs());
it('lets a solo host add ready computer seats and preserves them after a round',async()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');
 const session=crypto.randomUUID(),{room,host}=await createRoom('Host','#ef4444',session);
 const bot=await addComputerPlayer(room.code,session);expect(bot).toMatchObject({isComputer:true,isReady:true,isHost:false});
 expect(await getPlayerBySession(bot.sessionToken,room.id)).toBeNull();
 const state=await startGameInRoom(room.code,host.id);await expect(addComputerPlayer(room.code,session)).rejects.toThrow('before the game');expect(state.gameState.players.find(p=>p.id===bot.id)).toMatchObject({isComputer:true,isBot:true});
 const final={...state,gameState:{...state.gameState,status:'round_over' as const,version:state.gameState.version+1}};await saveAuthoritativeState(final,state.gameState.version);
 await returnRoomToLobby(room.code,session,final.gameState.version,final.gameState.roundId!);
 expect((await getPlayersInRoom(room.id)).find(p=>p.id===bot.id)?.isReady).toBe(true);
});
it('rejects guests, full tables and late additions',async()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','');const session=crypto.randomUUID(),{room,host}=await createRoom('Host','#ef4444',session),guestSession=crypto.randomUUID();await joinRoom(room.code,'Guest','#3b82f6',guestSession);
 await expect(addComputerPlayer(room.code,guestSession)).rejects.toThrow('Only the host');
 for(let i=0;i<8;i++)await addComputerPlayer(room.code,session);
 await expect(addComputerPlayer(room.code,session)).rejects.toThrow('full');expect((await getPlayersInRoom(room.id)).filter(p=>p.isHost)).toHaveLength(1);expect(host.isHost).toBe(true);
});
