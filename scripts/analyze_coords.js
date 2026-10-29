const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's find all unique card templates across the 114 groups
// In UNO there are:
// 4 colors (red, yellow, green, blue)
// 10 numbers (0, 1, 2, 3, 4, 5, 6, 7, 8, 9) -> 40 cards
// 3 action types (skip, reverse, draw2) -> 12 cards
// 2 wild types (wild, wild_draw4) -> 2 cards (or 4 colored variants? no, wild has black background)
// Plus card back!
// Total unique card faces in UNO = 4 * 10 + 4 * 3 + 2 = 54 card faces!
// Plus card back = 55!

// Let's write a script that analyzes the geometry of each card group to uniquely match:
// - color: red (#ff5555), yellow (#ffaa00), green (#55aa55), blue (#5555ff or #5555fd), black (#000000)
// - symbol: digit 0-9, skip, reverse, draw2 (+2), wild, wild_draw4, or card_back!

function getGroupSnippet(id) {
  const marker = `id="${id}"`;
  const idx = svg.indexOf(marker);
  if (idx === -1) return null;
  const start = svg.lastIndexOf('<g', idx);
  let pos = start;
  let depth = 0;
  while (pos < svg.length) {
    if (svg.startsWith('<g', pos) && !svg.slice(p => false, pos+10).includes('/>')) { // safe check
      if (svg[pos+1] === 'g' && (svg[pos+2] === ' ' || svg[pos+2] === '\n' || svg[pos+2] === '\r' || svg[pos+2] === '>')) {
        depth++;
      }
      pos += 2;
    } else if (svg.startsWith('</g>', pos)) {
      depth--;
      pos += 4;
      if (depth === 0) {
        return svg.slice(start, pos);
      }
    } else {
      pos++;
    }
  }
  return null;
}

// Let's check card_analysis.json that we generated earlier
const cards = JSON.parse(fs.readFileSync('card_analysis.json', 'utf-8'));

// Filter out empty groups (mainColor == 'unknown')
const validCards = cards.filter(c => c.mainColor !== 'unknown');
console.log('Valid cards count:', validCards.length);

// Let's see what unique border coordinates exist for each color
const byColorAndCoords = {};
validCards.forEach(c => {
  const key = `${c.mainColor} | ${c.border}`;
  byColorAndCoords[key] = (byColorAndCoords[key] || 0) + 1;
});
console.log('Unique (color, border coords) entries count:', Object.keys(byColorAndCoords).length);

// Let's examine all unique entries for red:
console.log('\nRed cards:');
validCards.filter(c => c.mainColor === '#ff5555').forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount}`);
});

console.log('\nYellow cards:');
validCards.filter(c => c.mainColor === '#ffaa00').forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount}`);
});

console.log('\nGreen cards:');
validCards.filter(c => c.mainColor === '#55aa55').forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount}`);
});

console.log('\nBlue cards:');
validCards.filter(c => c.mainColor.startsWith('#5555')).forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount}`);
});
