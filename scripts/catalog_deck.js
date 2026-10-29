const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's analyze how many distinct cards there are and their layout
// In UNO:
// Colors: Red, Yellow, Green, Blue
// Numbers: 0 (1 copy per color), 1-9 (2 copies per color) -> 19 cards per color * 4 = 76 number cards
// Action cards:
// Skip (2 copies per color * 4 = 8)
// Reverse (2 copies per color * 4 = 8)
// Draw Two (+2) (2 copies per color * 4 = 8)
// Total color cards: 76 + 24 = 100 cards
// Wild cards:
// Wild (4 copies)
// Wild Draw Four (4 copies)
// Total deck = 108 cards!

// Let's see what is in UNO_cards_deck.svg:
// Is it the full 108 cards, or is it 104 or 108 cards?
// Let's find out!

// Let's find all rects that represent a card outer border
const rectMatches = [];
const regex = /<rect\b([^>]*width="([0-9]+)"[^>]*height="([0-9]+)"[^>]*)>/g;
let m;
while ((m = regex.exec(svg)) !== null) {
  const full = m[1];
  const w = m[2];
  const h = m[3];
  if ((w === '60' && h === '90') || (w === '240' && h === '360')) {
    const xMatch = full.match(/\bx="([^"]+)"/);
    const yMatch = full.match(/\by="([^"]+)"/);
    const idMatch = full.match(/\bid="([^"]+)"/);
    rectMatches.push({
      w, h,
      x: xMatch ? xMatch[1] : null,
      y: yMatch ? yMatch[1] : null,
      id: idMatch ? idMatch[1] : null,
      index: m.index
    });
  }
}

console.log('Total card border rects found:', rectMatches.length);
console.log('Breakdown by width:', {
  w60: rectMatches.filter(r => r.w === '60').length,
  w240: rectMatches.filter(r => r.w === '240').length
});

// Let's inspect the w240 rects
console.log('\nw240 rects:');
rectMatches.filter(r => r.w === '240').forEach(r => console.log(r));
