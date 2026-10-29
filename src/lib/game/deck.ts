import { Card, CardColor, CardValue } from './types';

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue'];
const NUMBERS: CardValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Creates the official classic 108-card UNO deck.
 */
export function createClassicDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of COLORS) {
    // 1 zero per color
    deck.push({
      id: `${color}_0_0`,
      color,
      value: '0',
      assetFile: `${color}_0.svg`,
    });

    // 2 of each number 1-9 per color
    for (const num of NUMBERS.slice(1)) {
      deck.push({
        id: `${color}_${num}_0`,
        color,
        value: num,
        assetFile: `${color}_${num}.svg`,
      });
      deck.push({
        id: `${color}_${num}_1`,
        color,
        value: num,
        assetFile: `${color}_${num}.svg`,
      });
    }

    // 2 Skips per color
    deck.push({ id: `${color}_skip_0`, color, value: 'skip', assetFile: `${color}_skip.svg` });
    deck.push({ id: `${color}_skip_1`, color, value: 'skip', assetFile: `${color}_skip.svg` });

    // 2 Reverses per color
    deck.push({ id: `${color}_reverse_0`, color, value: 'reverse', assetFile: `${color}_reverse.svg` });
    deck.push({ id: `${color}_reverse_1`, color, value: 'reverse', assetFile: `${color}_reverse.svg` });

    // 2 Draw Two per color
    deck.push({ id: `${color}_draw2_0`, color, value: 'draw2', assetFile: `${color}_draw2.svg` });
    deck.push({ id: `${color}_draw2_1`, color, value: 'draw2', assetFile: `${color}_draw2.svg` });
  }

  // 4 Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_wild_${i}`,
      color: 'wild',
      value: 'wild',
      assetFile: 'wild.svg',
    });
  }

  // 4 Wild Draw Four cards
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild_draw4_${i}`,
      color: 'wild',
      value: 'draw4',
      assetFile: 'wild_draw4.svg',
    });
  }

  return deck;
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm.
 * An optional pseudo-random function can be provided for deterministic testing.
 */
export function shuffleDeck(cards: Card[], rng: () => number = Math.random): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
