import { describe, it, expect } from 'vitest';
import { createClassicDeck, shuffleDeck } from './deck';
import {
  startNewGame,
  isCardPlayable,
  playCardAction,
  drawCardAction,
  chooseColorAction,
  resolveDraw4ChallengeAction,
  passTurnAction,
  callUnoAction,
  catchUnoAction,
  getNextTurnIndex,
} from './engine';
import { Card, ServerAuthoritativeState } from './types';

describe('UNO Classic Game Engine', () => {
  describe('Deck Generation', () => {
    it('creates a standard 108-card deck with correct distributions', () => {
      const deck = createClassicDeck();
      expect(deck).toHaveLength(108);

      const colors = ['red', 'yellow', 'green', 'blue'];
      for (const color of colors) {
        const colorCards = deck.filter((c) => c.color === color);
        // Each color has 25 cards (1 zero, 18 numbers 1-9, 2 skip, 2 reverse, 2 draw2)
        expect(colorCards).toHaveLength(25);
        expect(colorCards.filter((c) => c.value === '0')).toHaveLength(1);
        for (let i = 1; i <= 9; i++) {
          expect(colorCards.filter((c) => c.value === i.toString())).toHaveLength(2);
        }
        expect(colorCards.filter((c) => c.value === 'skip')).toHaveLength(2);
        expect(colorCards.filter((c) => c.value === 'reverse')).toHaveLength(2);
        expect(colorCards.filter((c) => c.value === 'draw2')).toHaveLength(2);
      }

      // 4 Wild and 4 Wild Draw Four
      expect(deck.filter((c) => c.color === 'wild' && c.value === 'wild')).toHaveLength(4);
      expect(deck.filter((c) => c.color === 'wild' && c.value === 'draw4')).toHaveLength(4);
    });

    it('shuffles cards without losing or duplicating items', () => {
      const deck = createClassicDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(108);
      const originalIds = new Set(deck.map((c) => c.id));
      const shuffledIds = new Set(shuffled.map((c) => c.id));
      expect(shuffledIds.size).toBe(108);
      expect(shuffledIds).toEqual(originalIds);
    });
  });

  describe('Game Initialization', () => {
    it('deals 7 cards to each player and flips starting card', () => {
      const players = [
        { id: 'p1', name: 'Alice', avatarColor: '#ef4444', isHost: true },
        { id: 'p2', name: 'Bob', avatarColor: '#3b82f6', isHost: false },
        { id: 'p3', name: 'Charlie', avatarColor: '#10b981', isHost: false },
      ];

      const state = startNewGame('room-1', players);
      expect(state.gameState.players).toHaveLength(3);
      expect(state.playerHands['p1']).toHaveLength(7);
      expect(state.playerHands['p2']).toHaveLength(7);
      expect(state.playerHands['p3']).toHaveLength(7);

      expect(state.gameState.topDiscard).toBeDefined();
      expect(state.gameState.topDiscard.value).not.toBe('draw4'); // Draw 4 cannot be start card
      const expectedDrawPile = 108 - 21 - 1;
      expect(state.gameState.drawPileCount).toBe(expectedDrawPile);
    });

    it('handles 10 players properly', () => {
      const players = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Player ${i + 1}`,
        avatarColor: '#fff',
        isHost: i === 0,
      }));

      const state = startNewGame('room-10', players);
      expect(state.gameState.players).toHaveLength(10);
      if (state.gameState.topDiscard.value === 'draw2') {
        expect(state.playerHands['p1']).toHaveLength(9);
      } else {
        expect(state.playerHands['p1']).toHaveLength(7);
      }
      for (let i = 2; i <= 10; i++) {
        expect(state.playerHands[`p${i}`]).toHaveLength(7);
      }
    });
  });

  describe('Card Legality Checking', () => {
    const redFive: Card = { id: 'r5', color: 'red', value: '5', assetFile: 'red_5.svg' };
    const blueFive: Card = { id: 'b5', color: 'blue', value: '5', assetFile: 'blue_5.svg' };
    const redSkip: Card = { id: 'rs', color: 'red', value: 'skip', assetFile: 'red_skip.svg' };
    const greenSkip: Card = { id: 'gs', color: 'green', value: 'skip', assetFile: 'green_skip.svg' };
    const wildCard: Card = { id: 'w', color: 'wild', value: 'wild', assetFile: 'wild.svg' };
    const wildDraw4: Card = { id: 'wd4', color: 'wild', value: 'draw4', assetFile: 'wild_draw4.svg' };

    it('matches same color', () => {
      expect(isCardPlayable(redSkip, 'red', redFive)).toBe(true);
    });

    it('matches same value with different color', () => {
      expect(isCardPlayable(blueFive, 'red', redFive)).toBe(true);
      expect(isCardPlayable(greenSkip, 'red', redSkip)).toBe(true);
    });

    it('allows wild cards on any discard card', () => {
      expect(isCardPlayable(wildCard, 'red', redFive)).toBe(true);
      expect(isCardPlayable(wildDraw4, 'red', redFive)).toBe(true);
    });

    it('rejects mismatching cards', () => {
      const yellowTwo: Card = { id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' };
      expect(isCardPlayable(yellowTwo, 'red', redFive)).toBe(false);
    });
  });

  describe('Action Cards & Gameplay Flow', () => {
    function createMockState(): ServerAuthoritativeState {
      return {
        drawPile: [
          { id: 'r1', color: 'red', value: '1', assetFile: 'red_1.svg' },
          { id: 'b2', color: 'blue', value: '2', assetFile: 'blue_2.svg' },
          { id: 'g3', color: 'green', value: '3', assetFile: 'green_3.svg' },
          { id: 'y4', color: 'yellow', value: '4', assetFile: 'yellow_4.svg' },
          { id: 'r5', color: 'red', value: '5', assetFile: 'red_5.svg' },
          { id: 'b6', color: 'blue', value: '6', assetFile: 'blue_6.svg' },
          { id: 'g7', color: 'green', value: '7', assetFile: 'green_7.svg' },
          { id: 'y8', color: 'yellow', value: '8', assetFile: 'yellow_8.svg' },
        ],
        playerHands: {
          p1: [
            { id: 'r_skip', color: 'red', value: 'skip', assetFile: 'red_skip.svg' },
            { id: 'r_rev', color: 'red', value: 'reverse', assetFile: 'red_reverse.svg' },
            { id: 'r_d2', color: 'red', value: 'draw2', assetFile: 'red_draw2.svg' },
            { id: 'w1', color: 'wild', value: 'wild', assetFile: 'wild.svg' },
            { id: 'wd4_1', color: 'wild', value: 'draw4', assetFile: 'wild_draw4.svg' },
          ],
          p2: [
            { id: 'r7', color: 'red', value: '7', assetFile: 'red_7.svg' },
            { id: 'b7', color: 'blue', value: '7', assetFile: 'blue_7.svg' },
          ],
          p3: [
            { id: 'g5', color: 'green', value: '5', assetFile: 'green_5.svg' },
          ],
        },
        gameState: {
          roomId: 'test-room',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 5, isReady: true, isHost: true, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 2, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p3', name: 'Charlie', avatarColor: '#green', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 4,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };
    }

    it('Skip skips the next player', () => {
      const state = createMockState();
      const next = playCardAction(state, 'p1', 'r_skip');
      // In 3-player game: p1 plays skip -> skips p2 -> turn goes to p3 (index 2)
      expect(next.gameState.turnIndex).toBe(2);
      expect(next.playerHands['p1']).toHaveLength(4);
    });

    it('Reverse reverses turn direction in 3+ player game', () => {
      const state = createMockState();
      const next = playCardAction(state, 'p1', 'r_rev');
      expect(next.gameState.turnDirection).toBe(-1);
      // Alice (0) played reverse with direction -1 -> next turn is Charlie (index 2)
      expect(next.gameState.turnIndex).toBe(2);
    });

    it('Reverse in a 2-player game behaves like a Skip', () => {
      const state = createMockState();
      state.gameState.players = state.gameState.players.slice(0, 2);
      const next = playCardAction(state, 'p1', 'r_rev');
      // In 2 players, reverse skips opponent, so turn returns to p1 (index 0)
      expect(next.gameState.turnIndex).toBe(0);
    });

    it('Draw Two offers stacking before drawing the penalty', () => {
      const next = playCardAction(createMockState(), 'p1', 'r_d2');
      expect(next.gameState.drawPenalty).toEqual({ amount: 2, value: 'draw2' });
      expect(next.gameState.turnIndex).toBe(1);
      const accepted = drawCardAction(next, 'p2');
      expect(accepted.playerHands.p2).toHaveLength(4);
      expect(accepted.gameState.turnIndex).toBe(2);
      expect(accepted.gameState.drawPenalty).toBeUndefined();
    });

    it('Wild card pauses turn until color is chosen', () => {
      const state = createMockState();
      const next = playCardAction(state, 'p1', 'w1');
      expect(next.gameState.pendingAction.type).toBe('choose_color_wild');
      expect(next.gameState.pendingAction.playerId).toBe('p1');

      // Now p1 chooses yellow
      const resolved = chooseColorAction(next, 'p1', 'yellow');
      expect(resolved.gameState.activeColor).toBe('yellow');
      expect(resolved.gameState.pendingAction.type).toBe('none');
      expect(resolved.gameState.turnIndex).toBe(1); // Advances to Bob
    });

    it('Wild Draw Four allows stacking without an official challenge', () => {
      const next = chooseColorAction(playCardAction(createMockState(), 'p1', 'wd4_1'), 'p1', 'blue');
      expect(next.gameState.pendingAction.type).toBe('none');
      expect(next.gameState.drawPenalty).toEqual({ amount: 4, value: 'draw4' });
      expect(next.gameState.turnIndex).toBe(1);
    });
  });

  describe('Drawing and Passing Mechanics', () => {
    it('allows playing newly drawn card if legal', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [
          { id: 'r9', color: 'red', value: '9', assetFile: 'red_9.svg' },
        ],
        playerHands: {
          p1: [{ id: 'b1', color: 'blue', value: '1', assetFile: 'blue_1.svg' }],
          p2: [{ id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' }],
        },
        gameState: {
          roomId: 'room-draw',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 1, isReady: true, isHost: true, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 1,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      // Alice draws r9 (which is playable on red 0)
      const afterDraw = drawCardAction(state, 'p1');
      expect(afterDraw.gameState.drawnCardPlayableId).toBe('r9');
      expect(afterDraw.gameState.turnIndex).toBe(0); // Alice still has turn

      // Alice cannot play b1 (not the newly drawn card)
      expect(() => playCardAction(afterDraw, 'p1', 'b1')).toThrow();

      // Alice plays r9
      const afterPlay = playCardAction(afterDraw, 'p1', 'r9');
      expect(afterPlay.gameState.topDiscard.id).toBe('r9');
      expect(afterPlay.gameState.drawnCardPlayableId).toBeNull();
    });

    it('advances turn automatically if drawn card is not playable', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [
          { id: 'g9', color: 'green', value: '9', assetFile: 'green_9.svg' },
        ],
        playerHands: {
          p1: [{ id: 'b1', color: 'blue', value: '1', assetFile: 'blue_1.svg' }],
          p2: [{ id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' }],
        },
        gameState: {
          roomId: 'room-draw-auto',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 1, isReady: true, isHost: true, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 1,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      const afterDraw = drawCardAction(state, 'p1');
      // Green 9 is not playable on Red 0 -> turn automatically advances to Bob (index 1)
      expect(afterDraw.gameState.turnIndex).toBe(1);
      expect(afterDraw.gameState.drawnCardPlayableId).toBeNull();
    });
  });

  describe('UNO Declaration & Catch', () => {
    it('sets challengeable if player plays down to 1 card without declaring UNO', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [
          { id: 'r1', color: 'red', value: '1', assetFile: 'red_1.svg' },
          { id: 'r2', color: 'red', value: '2', assetFile: 'red_2.svg' },
        ],
        playerHands: {
          p1: [
            { id: 'r7', color: 'red', value: '7', assetFile: 'red_7.svg' },
            { id: 'r8', color: 'red', value: '8', assetFile: 'red_8.svg' },
          ],
          p2: [{ id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' }],
        },
        gameState: {
          roomId: 'room-uno',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 2, isReady: true, isHost: true, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 2,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      // Alice plays r7 without declaring UNO
      const next = playCardAction(state, 'p1', 'r7', false);
      expect(next.gameState.unoChallengeablePlayerId).toBe('p1');

      // Bob catches Alice!
      const afterCatch = catchUnoAction(next, 'p2', 'p1');
      expect(afterCatch.gameState.unoChallengeablePlayerId).toBeNull();
      // Alice draws 2 cards penalty! (1 remaining + 2 = 3)
      expect(afterCatch.playerHands['p1']).toHaveLength(3);
    });

    it('protects player who calls UNO simultaneously or before being caught', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [
          { id: 'r1', color: 'red', value: '1', assetFile: 'red_1.svg' },
        ],
        playerHands: {
          p1: [
            { id: 'r7', color: 'red', value: '7', assetFile: 'red_7.svg' },
            { id: 'r8', color: 'red', value: '8', assetFile: 'red_8.svg' },
          ],
          p2: [{ id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' }],
        },
        gameState: {
          roomId: 'room-uno-safe',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 2, isReady: true, isHost: true, isOnline: true, hasCalledUno: false, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 1,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      // Alice plays with UNO declared
      const next = playCardAction(state, 'p1', 'r7', true);
      expect(next.gameState.unoChallengeablePlayerId).toBeNull();
      expect(next.gameState.players[0].hasCalledUno).toBe(true);

      // Bob cannot catch Alice
      expect(() => catchUnoAction(next, 'p2', 'p1')).toThrow();
    });
  });

  describe('Win Detection', () => {
    it('finishes game when player plays their last card', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [],
        playerHands: {
          p1: [{ id: 'r7', color: 'red', value: '7', assetFile: 'red_7.svg' }],
          p2: [{ id: 'b2', color: 'blue', value: '2', assetFile: 'blue_2.svg' }],
        },
        gameState: {
          roomId: 'room-win',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 1, isReady: true, isHost: true, isOnline: true, hasCalledUno: true, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [{ id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }],
          drawPileCount: 0,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      const next = playCardAction(state, 'p1', 'r7');
      expect(next.gameState.status).toBe('round_over');
      expect(next.gameState.winnerPlayerId).toBe('p1');
      expect(next.playerHands['p1']).toHaveLength(0);
    });
  });

  describe('Edge Cases and Multiplayer Scaling', () => {
    it('automatically reshuffles discard pile when draw pile is empty', () => {
      const state: ServerAuthoritativeState = {
        drawPile: [], // Empty draw pile!
        playerHands: {
          p1: [{ id: 'b1', color: 'blue', value: '1', assetFile: 'blue_1.svg' }],
          p2: [{ id: 'y2', color: 'yellow', value: '2', assetFile: 'yellow_2.svg' }],
        },
        gameState: {
          roomId: 'room-recycle',
          status: 'playing',
          players: [
            { id: 'p1', name: 'Alice', avatarColor: '#red', cardCount: 1, isReady: true, isHost: true, isOnline: true, hasCalledUno: true, score: 0 },
            { id: 'p2', name: 'Bob', avatarColor: '#blue', cardCount: 1, isReady: true, isHost: false, isOnline: true, hasCalledUno: false, score: 0 },
          ],
          turnIndex: 0,
          turnDirection: 1,
          activeColor: 'red',
          topDiscard: { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' },
          discardPile: [
            { id: 'r1', color: 'red', value: '1', assetFile: 'red_1.svg' },
            { id: 'r2', color: 'red', value: '2', assetFile: 'red_2.svg' },
            { id: 'r3', color: 'red', value: '3', assetFile: 'red_3.svg' },
            { id: 'r0', color: 'red', value: '0', assetFile: 'red_0.svg' }, // top discard
          ],
          drawPileCount: 0,
          drawnCardPlayableId: null,
          pendingAction: { type: 'none', playerId: '' },
          unoChallengeablePlayerId: null,
          winnerPlayerId: null,
          version: 1,
          lastActionDescription: 'Init',
          updatedAt: Date.now(),
        },
      };

      // Alice draws from empty pile; should recycle r1, r2, r3 (leaving r0 as top discard)
      const afterDraw = drawCardAction(state, 'p1');
      expect(afterDraw.playerHands['p1']).toHaveLength(2);
      expect(afterDraw.gameState.discardPile).toHaveLength(1);
      expect(afterDraw.gameState.topDiscard.id).toBe('r0');
    });

    it('rejects illegal actions out of turn or invalid cards', () => {
      const state = startNewGame('room-err', [
        { id: 'p1', name: 'Alice', avatarColor: '#red', isHost: true },
        { id: 'p2', name: 'Bob', avatarColor: '#blue', isHost: false },
      ]);

      state.gameState.pendingAction = { type: 'none', playerId: '' };
      const activeId = state.gameState.players[state.gameState.turnIndex].id;
      const inactiveId = state.gameState.players[state.gameState.turnIndex === 0 ? 1 : 0].id;

      // Inactive player tries to play
      expect(() => playCardAction(state, inactiveId, 'any_card')).toThrow('It is not your turn');
      // Active player tries to play a card they do not own
      expect(() => playCardAction(state, activeId, 'fake_card_id')).toThrow('You do not own this card');
    });

    it('properly steps turns across 10 players clockwise and counter-clockwise', () => {
      const players = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        name: `Player ${i}`,
        avatarColor: '#fff',
        cardCount: 7,
        isReady: true,
        isHost: i === 0,
        isOnline: true,
        hasCalledUno: false,
        score: 0,
      }));

      // Test clockwise transition from player 9 to player 0
      expect(getNextTurnIndex(9, 10, 1, 0)).toBe(0);
      expect(getNextTurnIndex(0, 10, 1, 0)).toBe(1);

      // Test counter-clockwise transition from player 0 to player 9
      expect(getNextTurnIndex(0, 10, -1, 0)).toBe(9);
      expect(getNextTurnIndex(9, 10, -1, 0)).toBe(8);

      // Test skip in 10 players
      expect(getNextTurnIndex(8, 10, 1, 1)).toBe(0); // 8 skips 9 -> lands on 0
    });
  });
});
