import { describe, it, expect } from 'vitest';
import {
  createRoom,
  joinRoom,
  setPlayerReady,
  startGameInRoom,
  getAuthoritativeState,
  saveAuthoritativeState,
} from '../server/store';
import {
  playCardAction,
  drawCardAction,
  callUnoAction,
  catchUnoAction,
  chooseColorAction,
} from './engine';

describe('End-to-End Multiplayer Flow (2 to 10 Players)', () => {
  it('supports full 2-player game lifecycle from room creation to gameplay', async () => {
    // 1. Host creates room
    const hostToken = 'session_token_alice';
    const { room, host: alice } = await createRoom('Alice', '#ef4444', hostToken);
    expect(room.code).toHaveLength(6);
    expect(alice.isHost).toBe(true);
    expect(alice.isReady).toBe(true);

    // 2. Bob joins room using room code
    const bobToken = 'session_token_bob';
    const { player: bob } = await joinRoom(room.code, 'Bob', '#3b82f6', bobToken);
    expect(bob.isHost).toBe(false);
    expect(bob.isReady).toBe(false);

    // Bob marks ready
    await setPlayerReady(bob.id, true);

    // 3. Host starts game
    const initialState = await startGameInRoom(room.code, alice.id);
    expect(initialState.gameState.status).toBe('playing');
    expect(initialState.gameState.players).toHaveLength(2);

    // Confidentiality Check: Alice's hand has 7 cards (or 9 if start card was draw2)
    const aliceHand = initialState.playerHands[alice.id];
    const bobHand = initialState.playerHands[bob.id];
    expect(aliceHand.length).toBeGreaterThanOrEqual(7);
    expect(bobHand).toHaveLength(7);

    // Verify hands are distinct private arrays
    expect(aliceHand).not.toEqual(bobHand);

    // 4. Play turn
    const activePlayerId = initialState.gameState.players[initialState.gameState.turnIndex].id;
    const hand = initialState.playerHands[activePlayerId];

    // Find any legal card or draw
    const legalCard = hand.find(
      (c) =>
        c.color === 'wild' ||
        c.color === initialState.gameState.activeColor ||
        c.value === initialState.gameState.topDiscard.value
    );

    let nextState = initialState;
    if (legalCard) {
      if (legalCard.color === 'wild') {
        nextState = playCardAction(initialState, activePlayerId, legalCard.id);
        nextState = chooseColorAction(nextState, activePlayerId, 'blue');
      } else {
        nextState = playCardAction(initialState, activePlayerId, legalCard.id);
      }
      expect(nextState.gameState.topDiscard.id).toBe(legalCard.id);
    } else {
      // Draw card
      nextState = drawCardAction(initialState, activePlayerId);
      expect(nextState.playerHands[activePlayerId].length).toBe(hand.length + 1);
    }

    // Save updated state
    await saveAuthoritativeState(nextState);
    const loaded = await getAuthoritativeState(room.id);
    expect(loaded?.gameState.version).toBe(nextState.gameState.version);
  });

  it('supports 10 players joining and playing simultaneously in a room', async () => {
    const { room, host } = await createRoom('HostPlayer', '#ef4444', 'token_host_10');

    // 9 more players join
    const playerTokens = Array.from({ length: 9 }, (_, i) => `token_player_${i + 2}`);
    for (let i = 0; i < 9; i++) {
      const { player } = await joinRoom(
        room.code,
        `Friend ${i + 2}`,
        '#10b981',
        playerTokens[i]
      );
      await setPlayerReady(player.id, true);
    }

    // 10 players in room
    const gameState = await startGameInRoom(room.code, host.id);
    expect(gameState.gameState.players).toHaveLength(10);
    expect(gameState.gameState.status).toBe('playing');

    // Each player has their own private hand
    for (const p of gameState.gameState.players) {
      expect(gameState.playerHands[p.id].length).toBeGreaterThanOrEqual(7);
    }
  });

  it('handles multiple rooms independently without state cross-contamination', async () => {
    // Room A
    const { room: roomA, host: hostA } = await createRoom('Alice', '#ef4444', 'token_a1');
    const { player: bobA } = await joinRoom(roomA.code, 'Bob', '#3b82f6', 'token_a2');
    await setPlayerReady(bobA.id, true);
    const gameA = await startGameInRoom(roomA.code, hostA.id);

    // Room B
    const { room: roomB, host: hostB } = await createRoom('Charlie', '#10b981', 'token_b1');
    const { player: davidB } = await joinRoom(roomB.code, 'David', '#f59e0b', 'token_b2');
    await setPlayerReady(davidB.id, true);
    const gameB = await startGameInRoom(roomB.code, hostB.id);

    // Verify isolation
    expect(roomA.code).not.toBe(roomB.code);
    expect(gameA.gameState.roomId).not.toBe(gameB.gameState.roomId);
    expect(gameA.gameState.players[0].name).toBe('Alice');
    expect(gameB.gameState.players[0].name).toBe('Charlie');
  });
});
