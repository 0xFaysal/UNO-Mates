import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoom, joinRoom, getPlayersInRoom, getPlayerBySession, removeLobbyPlayer, renameLobbyPlayer, setPlayerReady, startGameInRoom, movePlayerSeat } from '../server/store';
beforeEach(()=>vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',''));
afterEach(()=>vi.unstubAllEnvs());
async function room(){
 const hostSession=crypto.randomUUID(),guestSession=crypto.randomUUID();
 const {room,host}=await createRoom('MangoHost','#ef4444',hostSession);
 const {player:guest}=await joinRoom(room.code,'OfflineMate','#3b82f6',guestSession);
 return {room,host,guest,hostSession,guestSession};
}
describe('Lobby member management',()=>{
 it('lets only the host remove another member and frees that seat',async()=>{
  const setup=await room();setup.guest.isOnline=false;
  await expect(removeLobbyPlayer(setup.room.code,setup.guestSession,setup.host.id)).rejects.toMatchObject({status:403});
  await expect(removeLobbyPlayer(setup.room.code,setup.hostSession,setup.host.id)).rejects.toMatchObject({status:400});
  await removeLobbyPlayer(setup.room.code,setup.hostSession,setup.guest.id);
  expect(await getPlayerBySession(setup.guestSession,setup.room.id)).toBeNull();
  expect(await getPlayersInRoom(setup.room.id)).toHaveLength(1);
  const replacement=await joinRoom(setup.room.code,'NewMate','#10b981',crypto.randomUUID());
  expect(replacement.player.seatIndex).toBe(setup.guest.seatIndex);
  await expect(removeLobbyPlayer(setup.room.code,setup.hostSession,setup.guest.id)).rejects.toThrow('already left');
  expect(await getPlayersInRoom(setup.room.id)).toHaveLength(2);
  await expect(movePlayerSeat(setup.room.id,setup.host.id,setup.guest.seatIndex,setup.guest.id)).rejects.toThrow('changed');
 });
 it('does not remove people from a different room or act for an unknown caller',async()=>{
  const first=await room(),second=await room();
  await expect(removeLobbyPlayer(first.room.code,first.hostSession,second.guest.id)).rejects.toThrow('already left');
  await expect(removeLobbyPlayer(first.room.code,'unknown',first.guest.id)).rejects.toMatchObject({status:403});
  expect(await getPlayersInRoom(second.room.id)).toHaveLength(2);
 });
 it('allows the caller to rename without changing readiness, avatar or seat',async()=>{
  const setup=await room();await setPlayerReady(setup.guest.id,true);
  expect(await renameLobbyPlayer(setup.room.code,setup.guestSession,'  New   Mate  ')).toBe('New Mate');
  const changed=await getPlayerBySession(setup.guestSession,setup.room.id);
  expect(changed).toMatchObject({name:'New Mate',seatIndex:1,isReady:true,avatarColor:'#3b82f6'});
  const started=await startGameInRoom(setup.room.code,setup.host.id);
  expect(started.gameState.players[1].name).toBe('New Mate');
 });
 it('rejects duplicate, blank, long and control-character names without mutation',async()=>{
  const setup=await room();
  await expect(renameLobbyPlayer(setup.room.code,setup.guestSession,'mangohost')).rejects.toThrow('taken');
  for(const name of ['', '   ', 'x'.repeat(21), 'Mate'+String.fromCharCode(1)])await expect(renameLobbyPlayer(setup.room.code,setup.guestSession,name)).rejects.toMatchObject({status:400});
  expect((await getPlayerBySession(setup.guestSession,setup.room.id))?.name).toBe('OfflineMate');
  await expect(renameLobbyPlayer(setup.room.code,'unknown','Someone')).rejects.toMatchObject({status:403});
 });
 it('locks renaming and removal after start and permits a fresh join after removal',async()=>{
  const setup=await room();await removeLobbyPlayer(setup.room.code,setup.hostSession,setup.guest.id);
  const rejoined=await joinRoom(setup.room.code,'ReturnedMate','#3b82f6',setup.guestSession);
  expect(rejoined.player.id).not.toBe(setup.guest.id);await setPlayerReady(rejoined.player.id,true);
  await startGameInRoom(setup.room.code,setup.host.id);
  await expect(renameLobbyPlayer(setup.room.code,setup.guestSession,'TooLate')).rejects.toThrow('locked');
  await expect(removeLobbyPlayer(setup.room.code,setup.hostSession,rejoined.player.id)).rejects.toThrow('after');
 });
});
