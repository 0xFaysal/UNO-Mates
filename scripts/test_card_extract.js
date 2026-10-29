const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's inspect the transforms on layer1 and cards:
// layer1: transform="translate(1261,748.63787)"
// most cards: transform="matrix(4,0,0,4,-1260,-2077.0865)"
// inside the card group:
// rect width="60" height="90" x="60" y="332.36218"
// Notice:
// If we want each card to be standalone with viewBox="0 0 240 360":
// In local card coordinates (width 60, height 90):
// The card's bounding box is (x, y, 60, 90).
// If we set viewBox="${x} ${y} 60 90", then it will render perfectly in any aspect ratio (60:90 = 2:3 = 240:360)!
// And any child paths inside that group are in the EXACT SAME local coordinates!
// Let's verify this!

// Let's test this with g6563 (Red 1)
const g6563Match = svg.match(/<g\b[^>]*id="g6563"[\s\S]*?<\/g>\s*<\/g>/) || svg.match(/<g\b[^>]*id="g6563"[\s\S]*?<\/g>/);

// Let's check g6563 inner content
function getGroupSnippet(id) {
  const marker = `id="${id}"`;
  const idx = svg.indexOf(marker);
  if (idx === -1) return null;
  const start = svg.lastIndexOf('<g', idx);
  // find matching </g>
  let pos = start;
  let depth = 0;
  while (pos < svg.length) {
    if (svg.startsWith('<g', pos) && !svg.slice(pos, pos+10).includes('/>')) {
      depth++;
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

const g6563 = getGroupSnippet('g6563');
console.log('g6563 found:', !!g6563);
console.log(g6563.slice(0, 400));
