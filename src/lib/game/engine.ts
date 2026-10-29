import {
  Card,
  CardColor,
  GameState,
  PendingAction,
  PlayerPublic,
  ServerAuthoritativeState,
  TurnDirection,
} from './types';
import { createClassicDeck, shuffleDeck } from './deck';

/**
 * Checks if a card is legally playable on the current discard pile and active color.
 */
export function isCardPlayable(
  card: Card,
  activeColor: CardColor,
  topDiscard: Card
): boolean {
  // Wild and Wild Draw Four are always playable cards
  if (card.color === 'wild') {
    return true;
  }
  // Color match
  if (card.color === activeColor) {
    return true;
  }
  // Value match (e.g. Red 7 on Blue 7, or Blue Skip on Green Skip)
  if (card.value === topDiscard.value) {
    return true;
  }
  return false;
}

/** Shared legality for the server and the table's enabled cards. */
export function canPlayCard(card: Card, game: GameState, handSize: number): boolean {
  if (game.status !== 'playing' || game.pendingAction.type !== 'none') return false;
  if (handSize === 1 && !/^\d$/.test(card.value)) return false;
  if (game.drawnCardPlayableId && game.drawnCardPlayableId !== card.id) return false;
  if (game.drawPenalty) {
    return card.value === 'draw4' || (game.drawPenalty.value === 'draw2' && card.value === 'draw2');
  }
  return isCardPlayable(card, game.activeColor, game.topDiscard);
}

/**
 * Helper to compute the next player turn index, accounting for turn direction and skips.
 */
export function getNextTurnIndex(
  currentIndex: number,
  playerCount: number,
  direction: TurnDirection,
  skipCount: number = 0
): number {
  const step = direction * (1 + skipCount);
  let next = (currentIndex + step) % playerCount;
  while (next < 0) {
    next += playerCount;
  }
  return next;
}

/** Advance through unfinished seats, preserving the original seating order. */
export function getNextActiveTurnIndex(game: GameState, currentIndex: number, direction: TurnDirection, skipCount = 0): number {
  const finished = new Set(game.finishOrder || []);
  const active = game.players.filter(p => !finished.has(p.id) && p.cardCount > 0);
  if (!active.length) return currentIndex;
  let index = currentIndex;
  for (let step = 0; step <= skipCount; step++) {
    do { index = getNextTurnIndex(index, game.players.length, direction); }
    while (finished.has(game.players[index].id) || game.players[index].cardCount === 0);
  }
  return index;
}

/**
 * Reshuffles discard pile back into the draw pile when draw pile is low.
 * Retains the top card on the discard pile.
 */
function ensureDrawPile(
  drawPile: Card[],
  discardPile: Card[],
  needed: number,
  rng: () => number = Math.random
): { drawPile: Card[]; discardPile: Card[] } {
  if (drawPile.length >= needed) {
    return { drawPile, discardPile };
  }

  // All cards except the top discard card get shuffled
  const top = discardPile[discardPile.length - 1];
  const cardsToRecycle = discardPile.slice(0, discardPile.length - 1);
  const recycled = shuffleDeck(cardsToRecycle, rng);
  const newDrawPile = [...drawPile, ...recycled];

  return {
    drawPile: newDrawPile,
    discardPile: [top],
  };
}

/**
 * Draws N cards from the draw pile. Automatically reshuffles discard pile if needed.
 */
export function drawCardsFromPile(
  state: ServerAuthoritativeState,
  count: number,
  rng: () => number = Math.random
): { drawn: Card[]; state: ServerAuthoritativeState } {
  let { drawPile } = state;
  const { gameState } = state;
  let discardPile = [...gameState.discardPile];

  const ensured = ensureDrawPile(drawPile, discardPile, count, rng);
  drawPile = ensured.drawPile;
  discardPile = ensured.discardPile;

  const actualCount = Math.min(count, drawPile.length);
  const drawn = drawPile.slice(0, actualCount);
  const remainingDrawPile = drawPile.slice(actualCount);

  return {
    drawn,
    state: {
      ...state,
      drawPile: remainingDrawPile,
      gameState: {
        ...gameState,
        discardPile,
        topDiscard: discardPile[discardPile.length - 1],
        drawPileCount: remainingDrawPile.length,
      },
    },
  };
}

/**
 * Starts a new UNO game with the provided players list.
 */
export function startNewGame(
  roomId: string,
  players: { id: string; name: string; avatarColor: string; isHost: boolean }[],
  rng: () => number = Math.random
): ServerAuthoritativeState {
  if (players.length < 2 || players.length > 10) {
    throw new Error('UNO requires between 2 and 10 players');
  }

  // 1. Create and shuffle 108 cards
  let deck = shuffleDeck(createClassicDeck(), rng);

  // 2. Deal 7 cards to each player
  const playerHands: Record<string, Card[]> = {};
  const playersPublic: PlayerPublic[] = [];

  for (const p of players) {
    const hand = deck.slice(0, 7);
    deck = deck.slice(7);
    playerHands[p.id] = hand;

    playersPublic.push({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      cardCount: 7,
      isReady: true,
      isHost: p.isHost,
      isOnline: true,
      hasCalledUno: false,
      score: 0,
    });
  }

  // 3. Flip starting card (in official rules, Wild Draw Four cannot be the starting card)
  let topCardIndex = 0;
  while (topCardIndex < deck.length && deck[topCardIndex].value === 'draw4') {
    topCardIndex++;
  }
  if (topCardIndex >= deck.length) {
    // If somehow all are draw4, re-shuffle
    deck = shuffleDeck(deck, rng);
    topCardIndex = 0;
  }
  const startingCard = deck[topCardIndex];
  deck.splice(topCardIndex, 1);

  let turnIndex = 0;
  let turnDirection: TurnDirection = 1;
  const activeColor: CardColor = startingCard.color === 'wild' ? 'red' : startingCard.color;
  let pendingAction: PendingAction = { type: 'none', playerId: '' };
  let lastAction = `Game started. Starting card is ${startingCard.color} ${startingCard.value}.`;

  const state: ServerAuthoritativeState = {
    drawPile: deck,
    playerHands,
    gameState: {
      roomId,
      roundId: crypto.randomUUID(),
      roundStartedAt: Date.now(),
      recentPlays: [{ card: startingCard, playerId: null, name: 'Opening card' }],
      status: 'playing',
      players: playersPublic,
      turnIndex: 0,
      turnDirection: 1,
      activeColor,
      topDiscard: startingCard,
      discardPile: [startingCard],
      drawPileCount: deck.length,
      drawnCardPlayableId: null,
      pendingAction,
      unoChallengeablePlayerId: null,
      winnerPlayerId: null,
      finishOrder: [],
      version: 1,
      lastActionDescription: lastAction,
      updatedAt: Date.now(),
    },
  };

  // 4. Handle starting card action effects according to Classic Rules:
  if (startingCard.value === 'draw2') {
    state.gameState.drawPenalty = { amount: 2, value: 'draw2' };
    lastAction = 'Opening +2. First player may stack +2 or +4, or draw 2.';
  } else if (startingCard.value === 'reverse') {
    if (players.length === 2) {
      // In 2-player UNO, reverse acts like a skip!
      turnIndex = getNextTurnIndex(0, players.length, turnDirection, 0);
      lastAction = `Starting card was Reverse (2-player skip). Player 2 goes first.`;
    } else {
      turnDirection = -1;
      turnIndex = players.length - 1; // Dealer starts after an opening Reverse
      lastAction = `Starting card was Reverse. Play goes counter-clockwise.`;
    }
  } else if (startingCard.value === 'skip') {
    // First player loses turn
    const firstPlayer = playersPublic[0];
    turnIndex = getNextTurnIndex(0, players.length, turnDirection, 0);
    lastAction = `Starting card was Skip. ${firstPlayer.name} is skipped.`;
  } else if (startingCard.value === 'wild') {
    // First player chooses color
    pendingAction = {
      type: 'choose_color_wild',
      playerId: playersPublic[0].id,
      openingWild: true,
    };
    lastAction = `Starting card was Wild. ${playersPublic[0].name} must choose a color.`;
  }

  state.gameState.turnIndex = turnIndex;
  state.gameState.turnDirection = turnDirection;
  state.gameState.pendingAction = pendingAction;
  state.gameState.lastActionDescription = lastAction;

  return state;
}

/**
 * Handles playing a card by an active player.
 */
export function playCardAction(
  state: ServerAuthoritativeState,
  playerId: string,
  cardId: string,
  hasCalledUnoSimultaneously: boolean = false
): ServerAuthoritativeState {
  const { gameState, playerHands } = state;
  const currentTurnPlayer = gameState.players[gameState.turnIndex];

  if (gameState.status !== 'playing') {
    throw new Error('Game is not currently active');
  }

  if (currentTurnPlayer.id !== playerId) {
    throw new Error('It is not your turn');
  }

  if (gameState.pendingAction.type !== 'none') {
    throw new Error('Cannot play a card while a special action is pending');
  }

  // If player drew a card this turn, they may ONLY play that drawn card
  if (gameState.drawnCardPlayableId && gameState.drawnCardPlayableId !== cardId) {
    throw new Error('You may only play the card you just drew, or pass your turn');
  }

  const hand = playerHands[playerId] || [];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error('You do not own this card');
  }

  const card = hand[cardIndex];

  // Validate legality
  if (!canPlayCard(card, gameState, hand.length)) {
    throw new Error(`Cannot play ${card.color} ${card.value} on ${gameState.activeColor} ${gameState.topDiscard.value}`);
  }

  // Remove card from hand
  const newHand = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
  const newPlayerHands = { ...playerHands, [playerId]: newHand };

  // New discard pile
  const newDiscardPile = [...gameState.discardPile, card];

  // Update players list
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);
  const updatedPlayers = gameState.players.map((p, idx) => {
    if (idx === playerIndex) {
      const remainingCount = newHand.length;
      return {
        ...p,
        cardCount: remainingCount,
        hasCalledUno: remainingCount === 1 ? hasCalledUnoSimultaneously || p.hasCalledUno : false,
      };
    }
    return p;
  });

  // UNO challenge check
  let unoChallengeablePlayerId: string | null = null;
  if (newHand.length === 1) {
    if (!hasCalledUnoSimultaneously && !updatedPlayers[playerIndex].hasCalledUno) {
      unoChallengeablePlayerId = playerId;
    } else {
      unoChallengeablePlayerId = null;
    }
  } else if (newHand.length === 0) {
    unoChallengeablePlayerId = null;
  }

  let nextTurnIndex = gameState.turnIndex;
  let nextDirection = gameState.turnDirection;
  const nextActiveColor = card.color === 'wild' ? gameState.activeColor : card.color;
  let pendingAction: PendingAction = { type: 'none', playerId: '' };
  let lastAction = `${currentTurnPlayer.name} played ${card.color} ${card.value}.`;

  const nextState: ServerAuthoritativeState = {
    drawPile: state.drawPile,
    playerHands: newPlayerHands,
    gameState: {
      ...gameState,
      players: updatedPlayers,
      topDiscard: card,
      discardPile: newDiscardPile,
      drawnCardPlayableId: null,
      unoChallengeablePlayerId,
      version: gameState.version + 1,
      updatedAt: Date.now(),
    },
  };

  // Record each finisher. The final remaining player receives the last place.
  if (newHand.length === 0) {
    const finishOrder = [...(gameState.finishOrder || []), playerId];
    const remaining = updatedPlayers.filter(p => !finishOrder.includes(p.id));
    const complete = remaining.length <= 1;
    nextState.gameState = {
      ...nextState.gameState,
      finishOrder: complete ? [...finishOrder, ...remaining.map(p => p.id)] : finishOrder,
      winnerPlayerId: gameState.winnerPlayerId || playerId,
      status: complete ? 'round_over' : 'playing',
      activeColor: nextActiveColor,
      pendingAction: { type: 'none', playerId: '' },
      unoChallengeablePlayerId: null,
      turnIndex: complete ? gameState.turnIndex : getNextActiveTurnIndex(nextState.gameState, gameState.turnIndex, nextDirection),
      lastActionDescription: complete ? 'Round complete. Final rankings are ready.' : currentTurnPlayer.name + ' finished #' + finishOrder.length + '. Play continues!',
    };
    return nextState;
  }

  // Handle Card Action Effects
  if (card.value === 'skip') {
    nextTurnIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 1);
    const skippedPlayer = gameState.players[getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 0)];
    lastAction = `${currentTurnPlayer.name} skipped ${skippedPlayer.name}.`;
  } else if (card.value === 'reverse') {
    if (gameState.players.filter(p => !(gameState.finishOrder || []).includes(p.id) && p.cardCount > 0).length === 2) {
      // In 2-player UNO, reverse acts as a Skip
      nextTurnIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 1);
      lastAction = `${currentTurnPlayer.name} played Reverse (skips opponent).`;
    } else {
      nextDirection = (nextDirection * -1) as TurnDirection;
      nextTurnIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 0);
      lastAction = `${currentTurnPlayer.name} reversed turn direction.`;
    }
  } else if (card.value === 'draw2') {
    nextState.gameState.drawPenalty = { amount: (gameState.drawPenalty?.amount || 0) + 2, value: 'draw2' };
    nextTurnIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection);
    lastAction = `${currentTurnPlayer.name} played +2. Stack +2 or +4, or draw ${nextState.gameState.drawPenalty.amount}.`;
  } else if (card.value === 'wild') {
    // Player must choose color
    pendingAction = {
      type: 'choose_color_wild',
      playerId,
    };
    lastAction = `${currentTurnPlayer.name} played Wild and must choose a color.`;
  } else if (card.value === 'draw4') {
    nextState.gameState.drawPenalty = { amount: (gameState.drawPenalty?.amount || 0) + 4, value: 'draw4' };
    // Choose color before the next player responds.
    const targetIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 0);
    const targetPlayer = gameState.players[targetIndex];
    pendingAction = {
      type: 'choose_color_draw4',
      playerId,
      targetPlayerId: targetPlayer.id,
      previousActiveColor: gameState.activeColor,
      draw4CardPlayed: card,
    };
    lastAction = `${currentTurnPlayer.name} played Wild Draw Four against ${targetPlayer.name}.`;
  } else {
    // Standard number card
    nextTurnIndex = getNextActiveTurnIndex(gameState, gameState.turnIndex, nextDirection, 0);
  }

  nextState.gameState.turnIndex = nextTurnIndex;
  nextState.gameState.turnDirection = nextDirection;
  nextState.gameState.activeColor = nextActiveColor;
  nextState.gameState.pendingAction = pendingAction;
  nextState.gameState.lastActionDescription = lastAction;

  return nextState;
}

/**
 * Handles choosing a color for Wild or Wild Draw Four.
 */
export function chooseColorAction(
  state: ServerAuthoritativeState,
  playerId: string,
  chosenColor: 'red' | 'yellow' | 'green' | 'blue'
): ServerAuthoritativeState {
  const { gameState } = state;
  if (gameState.status !== 'playing') throw new Error('Game is not currently active');
  const pending = gameState.pendingAction;

  if (pending.playerId !== playerId) {
    throw new Error('You are not authorized to choose the color');
  }

  if (pending.type === 'choose_color_wild') {
    // Advance to next turn
    const nextTurnIndex = pending.openingWild ? gameState.turnIndex : getNextActiveTurnIndex(
      gameState, gameState.turnIndex, gameState.turnDirection,
      0
    );

    return {
      ...state,
      gameState: {
        ...gameState,
        activeColor: chosenColor,
        pendingAction: { type: 'none', playerId: '' },
        turnIndex: nextTurnIndex,
        lastActionDescription: `${gameState.players[gameState.turnIndex].name} chose color ${chosenColor}.`,
        version: gameState.version + 1,
        updatedAt: Date.now(),
      },
    };
  }

  if (pending.type === 'choose_color_draw4') {
    return {
      ...state,
      gameState: {
        ...gameState, activeColor: chosenColor,
        pendingAction: { type: 'none', playerId: '' },
        turnIndex: getNextActiveTurnIndex(gameState, gameState.turnIndex, gameState.turnDirection),
        lastActionDescription: 'Stack another +4 or draw the accumulated penalty.',
        version: gameState.version + 1, updatedAt: Date.now(),
      },
    };
  }

  throw new Error('No color selection pending');
}

/**
 * Handles the response to a Wild Draw Four: accept (+4 cards) or challenge.
 */
export function resolveDraw4ChallengeAction(): ServerAuthoritativeState {
  throw new Error('Draw Four challenges are disabled in house rules. Stack +4 or draw the penalty.');
}

/**
 * Handles drawing a card from the draw pile.
 */
export function drawCardAction(
  state: ServerAuthoritativeState,
  playerId: string,
  rng: () => number = Math.random
): ServerAuthoritativeState {
  const { gameState, playerHands } = state;
  const currentTurnPlayer = gameState.players[gameState.turnIndex];

  if (currentTurnPlayer.id !== playerId) {
    throw new Error('It is not your turn to draw');
  }

  if (gameState.pendingAction.type !== 'none') {
    throw new Error('A special action is pending');
  }

  if (gameState.drawnCardPlayableId) {
    throw new Error('You already drew a card this turn. Either play it or pass.');
  }

  if (gameState.status !== 'playing') throw new Error('Game is not currently active');
  if (gameState.drawPenalty) {
    const { drawn, state: afterDraw } = drawCardsFromPile(state, gameState.drawPenalty.amount, rng);
    const hand = [...playerHands[playerId], ...drawn];
    return {
      ...afterDraw,
      playerHands: { ...afterDraw.playerHands, [playerId]: hand },
      gameState: {
        ...afterDraw.gameState,
        players: gameState.players.map(p => p.id === playerId ? { ...p, cardCount: hand.length, hasCalledUno: false } : p),
        drawPenalty: undefined, drawnCardPlayableId: null, unoChallengeablePlayerId: null,
        turnIndex: getNextActiveTurnIndex(gameState, gameState.turnIndex, gameState.turnDirection),
        version: gameState.version + 1, updatedAt: Date.now(),
        lastActionDescription: currentTurnPlayer.name + ' drew ' + drawn.length + ' penalty cards and missed their turn.',
      },
    };
  }

  // Draw 1 card
  const { drawn, state: afterDraw } = drawCardsFromPile(state, 1, rng);
  if (drawn.length === 0) {
    throw new Error('Draw pile is empty');
  }

  const drawnCard = drawn[0];
  const newHand = [...(playerHands[playerId] || []), drawnCard];
  const playerIndex = gameState.players.findIndex((p) => p.id === playerId);

  const updatedPlayers = gameState.players.map((p, idx) => {
    if (idx === playerIndex) {
      return {
        ...p,
        cardCount: newHand.length,
        hasCalledUno: false, // Reset UNO call if player now has >1 cards
      };
    }
    return p;
  });

  const isPlayable = canPlayCard(drawnCard, afterDraw.gameState, newHand.length);

  let nextTurnIndex = gameState.turnIndex;
  let drawnCardPlayableId: string | null = null;
  let lastAction = `${currentTurnPlayer.name} drew a card.`;

  if (isPlayable) {
    // Player may choose to play this drawn card or pass
    drawnCardPlayableId = drawnCard.id;
    lastAction = `${currentTurnPlayer.name} drew a playable card.`;
  } else {
    // Turn passes automatically if not playable
    nextTurnIndex = getNextActiveTurnIndex(
      gameState, gameState.turnIndex, gameState.turnDirection,
      0
    );
  }

  return {
    ...afterDraw,
    playerHands: {
      ...playerHands,
      [playerId]: newHand,
    },
    gameState: {
      ...afterDraw.gameState,
      players: updatedPlayers,
      turnIndex: nextTurnIndex,
      drawnCardPlayableId,
      unoChallengeablePlayerId: null,
      lastActionDescription: lastAction,
      version: gameState.version + 1,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Handles passing turn after drawing a card that could have been played.
 */
export function passTurnAction(
  state: ServerAuthoritativeState,
  playerId: string
): ServerAuthoritativeState {
  const { gameState } = state;
  const currentTurnPlayer = gameState.players[gameState.turnIndex];

  if (currentTurnPlayer.id !== playerId) {
    throw new Error('It is not your turn');
  }

  if (gameState.status !== 'playing') throw new Error('Game is not currently active');
  if (!gameState.drawnCardPlayableId) {
    throw new Error('You cannot pass without drawing first');
  }

  const nextTurnIndex = getNextActiveTurnIndex(
      gameState, gameState.turnIndex, gameState.turnDirection,
    0
  );

  return {
    ...state,
    gameState: {
      ...gameState,
      turnIndex: nextTurnIndex,
      drawnCardPlayableId: null,
      lastActionDescription: `${currentTurnPlayer.name} decided not to play the drawn card and passed.`,
      version: gameState.version + 1,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Handles declaring UNO by a player.
 */
export function callUnoAction(
  state: ServerAuthoritativeState,
  playerId: string
): ServerAuthoritativeState {
  const { gameState } = state;
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');
  if (gameState.status !== 'playing' || (gameState.finishOrder || []).includes(playerId)) throw new Error('Finished players are spectating');

  if (player.cardCount > 2) {
    throw new Error('Cannot call UNO with more than 2 cards');
  }

  const updatedPlayers = gameState.players.map((p) =>
    p.id === playerId ? { ...p, hasCalledUno: true } : p
  );

  const unoChallengeablePlayerId =
    gameState.unoChallengeablePlayerId === playerId
      ? null
      : gameState.unoChallengeablePlayerId;

  return {
    ...state,
    gameState: {
      ...gameState,
      players: updatedPlayers,
      unoChallengeablePlayerId,
      lastActionDescription: `${player.name} called UNO!`,
      version: gameState.version + 1,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Catches an opponent who failed to declare UNO when down to 1 card.
 * Offender draws 2 penalty cards.
 */
export function catchUnoAction(
  state: ServerAuthoritativeState,
  catcherId: string,
  targetPlayerId: string,
  rng: () => number = Math.random
): ServerAuthoritativeState {
  const { gameState, playerHands } = state;

  if (gameState.status !== 'playing' || catcherId === targetPlayerId) throw new Error('Invalid UNO catch');
  if (gameState.unoChallengeablePlayerId !== targetPlayerId) {
    throw new Error('Target player cannot be caught for UNO');
  }

  const targetPlayer = gameState.players.find((p) => p.id === targetPlayerId);
  const catcher = gameState.players.find((p) => p.id === catcherId);
  if (!targetPlayer || !catcher) throw new Error('Invalid players');
  if ((gameState.finishOrder || []).includes(catcherId) || (gameState.finishOrder || []).includes(targetPlayerId)) throw new Error('Finished players are spectating');

  const targetIndex = gameState.players.findIndex((p) => p.id === targetPlayerId);

  // Target draws 2 penalty cards
  const { drawn, state: afterDraw } = drawCardsFromPile(state, 2, rng);
  const newHand = [...(playerHands[targetPlayerId] || []), ...drawn];

  const updatedPlayers = afterDraw.gameState.players.map((p, idx) =>
    idx === targetIndex ? { ...p, cardCount: newHand.length, hasCalledUno: false } : p
  );

  return {
    ...afterDraw,
    playerHands: {
      ...afterDraw.playerHands,
      [targetPlayerId]: newHand,
    },
    gameState: {
      ...afterDraw.gameState,
      players: updatedPlayers,
      unoChallengeablePlayerId: null,
      lastActionDescription: `${catcher.name} caught ${targetPlayer.name} for not declaring UNO! ${targetPlayer.name} draws 2 cards.`,
      version: gameState.version + 1,
      updatedAt: Date.now(),
    },
  };
}
