import { it, expect } from 'vitest';
import { createRoom, joinRoom, getPlayersInRoom, movePlayerSeat, setPlayerReady, startGameInRoom } from '../server/store';
import { chooseNickname } from './nicknames';
it('assigns unique funny names and ten distinct seats', async () => {
 const { room, host } = await createRoom('Player', '#ef4444', crypto.randomUUID());
 const players = [host];
 for(let i=0;i<9;i++) players.push((await joinRoom(room.code,'Player','#3b82f6',crypto.randomUUID())).player);
 expect(new Set(players.map(p=>p.name)).size).toBe(10);
 expect(new Set(players.map(p=>p.seatIndex)).size).toBe(10);
 expect(players.every(p=>!/^Player/i.test(p.name))).toBe(true);
 await expect(joinRoom(room.code,'Player','#3b82f6',crypto.randomUUID())).rejects.toThrow('full');
});
it('moves and swaps seats, rejects a stale occupant, and starts in seat order', async () => {
 const { room, host } = await createRoom('Host', '#ef4444', crypto.randomUUID());
 const { player } = await joinRoom(room.code,'Guest','#3b82f6',crypto.randomUUID());
 await movePlayerSeat(room.id,host.id,7);
 expect((await getPlayersInRoom(room.id)).map(p=>p.id)).toEqual([player.id,host.id]);
 await expect(movePlayerSeat(room.id,host.id,1)).rejects.toThrow('changed');
 await movePlayerSeat(room.id,host.id,1,player.id);
 expect((await getPlayersInRoom(room.id)).map(p=>p.id)).toEqual([host.id,player.id]);
 await setPlayerReady(player.id,true);
 const game = await startGameInRoom(room.code,host.id);
 expect(game.gameState.players.map(p=>p.id)).toEqual([host.id,player.id]);
 await expect(movePlayerSeat(room.id,host.id,5)).rejects.toThrow('locked');
});
it('keeps custom names but replaces generic or duplicate names',()=>{
 expect(chooseNickname('Faysal')).toBe('Faysal');
 expect(chooseNickname('Player 1')).not.toBe('Player 1');
 expect(chooseNickname('Cha Ninja',['Cha Ninja'])).not.toBe('Cha Ninja');
});
