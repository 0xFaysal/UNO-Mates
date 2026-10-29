import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { createRoom,joinRoom,setPlayerReady,startGameInRoom,returnRoomToLobby,getGameContext,getPlayersInRoom } from '../server/store';
beforeEach(()=>vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',''));
afterEach(()=>vi.unstubAllEnvs());
describe('Return a completed table to the lobby',()=>{
 it('protects the active round, resets readiness and permits a new game with the same seats',async()=>{
  const hs=crypto.randomUUID(),gs=crypto.randomUUID();
  const {room,host}=await createRoom('Host','#ef4444',hs), {player:guest}=await joinRoom(room.code,'Mate','#3b82f6',gs);
  await setPlayerReady(guest.id,true);const state=await startGameInRoom(room.code,host.id);
  await expect(returnRoomToLobby(room.code,hs,state.gameState.version,state.gameState.roundId!)).rejects.toThrow('round changed');
  await expect(returnRoomToLobby(room.code,gs,state.gameState.version,state.gameState.roundId!)).rejects.toMatchObject({status:403});
  state.gameState.status='round_over';
  await expect(returnRoomToLobby(room.code,hs,state.gameState.version+1,state.gameState.roundId!)).rejects.toThrow('round changed');
  await returnRoomToLobby(room.code,hs,state.gameState.version,state.gameState.roundId!);
  await returnRoomToLobby(room.code,hs,state.gameState.version,state.gameState.roundId!);
  expect(await getGameContext(room.code,hs)).toMatchObject({roomStatus:'lobby',state:null});
  expect((await getPlayersInRoom(room.id)).map(p=>[p.id,p.seatIndex,p.isReady])).toEqual([[host.id,0,true],[guest.id,1,false]]);
  await setPlayerReady(guest.id,true);const next=await startGameInRoom(room.code,host.id);
  expect(next.gameState.roundId).not.toBe(state.gameState.roundId);expect(next.playerHands[host.id]).toHaveLength(7);
 });
});
