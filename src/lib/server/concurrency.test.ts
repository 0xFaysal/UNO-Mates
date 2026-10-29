import { it, expect } from 'vitest';
import { createRoom, joinRoom, setPlayerReady, startGameInRoom, saveAuthoritativeState, getAuthoritativeState } from './store';
it('rejects a second move based on the same old game version', async () => {
 const { room, host } = await createRoom('Host', '#ef4444', crypto.randomUUID());
 const { player } = await joinRoom(room.code, 'Guest', '#3b82f6', crypto.randomUUID());
 await setPlayerReady(player.id, true);
 const initial = await startGameInRoom(room.code, host.id);
 const moveA = structuredClone(initial); const moveB = structuredClone(initial);
 moveA.gameState.version++; moveB.gameState.version++;
 moveA.gameState.lastActionDescription = 'Move A'; moveB.gameState.lastActionDescription = 'Move B';
 await saveAuthoritativeState(moveA, initial.gameState.version);
 await expect(saveAuthoritativeState(moveB, initial.gameState.version)).rejects.toThrow('Game changed');
 expect((await getAuthoritativeState(room.id))?.gameState.lastActionDescription).toBe('Move A');
});
