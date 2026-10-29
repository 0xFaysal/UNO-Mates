export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4';

export interface Card {
  id: string; // unique card id in deck, e.g. "red_7_0"
  color: CardColor;
  value: CardValue;
  assetFile: string;
}

export type TurnDirection = 1 | -1; // 1 = clockwise, -1 = counter-clockwise

export interface PlayerPublic {
  id: string;
  name: string;
  avatarColor: string;
  cardCount: number;
  isReady: boolean;
  isHost: boolean;
  isOnline: boolean;
  hasCalledUno: boolean;
  score: number;
}

export type GameStatus = 'waiting' | 'playing' | 'round_over' | 'game_over';

export type PendingActionType =
  | 'none'
  | 'choose_color_wild'
  | 'choose_color_draw4'
  | 'challenge_draw4';

export interface PendingAction {
  openingWild?: boolean;
  type: PendingActionType;
  playerId: string; // The player who must perform the action
  targetPlayerId?: string; // e.g. the player subjected to draw4 challenge
  draw4CardPlayed?: Card;
  previousActiveColor?: CardColor;
}

export interface GameState {
  drawPenalty?: { amount: number; value: 'draw2' | 'draw4' };
  roomId: string;
  status: GameStatus;
  players: PlayerPublic[];
  turnIndex: number; // Index in players array
  turnDirection: TurnDirection;
  activeColor: CardColor;
  topDiscard: Card;
  discardPile: Card[]; // topDiscard is discardPile[discardPile.length - 1]
  drawPileCount: number; // Hidden from clients
  drawnCardPlayableId: string | null; // If current player just drew 1 card and can play it
  pendingAction: PendingAction;
  unoChallengeablePlayerId: string | null;
  winnerPlayerId: string | null;
  version: number;
  lastActionDescription: string;
  updatedAt: number;
}

export interface ServerAuthoritativeState {
  gameState: GameState;
  drawPile: Card[];
  playerHands: Record<string, Card[]>; // playerId -> Card[]
}

export interface GameActionResult {
  success: boolean;
  error?: string;
  state?: ServerAuthoritativeState;
  publicState?: GameState;
  privateHand?: Card[];
}
