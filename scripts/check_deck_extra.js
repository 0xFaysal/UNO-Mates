const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's check what other elements exist outside layer1 or in layer1
console.log('Does defs have children?');
const defsMatch = svg.match(/<defs[\s\S]*?<\/defs>/);
console.log(defsMatch ? defsMatch[0] : 'no defs');

// Are there any other layers?
const layers = svg.match(/<g\b[^>]*inkscape:groupmode="layer"[^>]*>/g) || svg.match(/<g\b[^>]*id="layer\d+"[^>]*>/g);
console.log('Layers found:', layers);

// Let's check the remaining 2 copies of g9888:
// We found 6 copies of g9888:
// g9888, g9888-0, g9888-0-5, g9888-0-5-2, g9888-0-5-21, g9888-0-5-0
// Let's check what is in g9888-0-5-21 and g9888-0-5-0
function getGroup(id) {
  const marker = `id="${id}"`;
  const idx = svg.indexOf(marker);
  const start = svg.lastIndexOf('<g', idx);
  let pos = start;
  let depth = 0;
  while (pos < svg.length) {
    if (svg.startsWith('<g', pos) && !svg.slice(pos, pos+10).includes('/>')) {
      depth++;
      pos += 2;
    } else if (svg.startsWith('</g>', pos)) {
      depth--;
      pos += 4;
      if (depth === 0) return svg.slice(start, pos);
    } else {
      pos++;
    }
  }
  return null;
}

console.log('g9888-0-5-21:');
const g21 = getGroup('g9888-0-5-21');
console.log(g21 ? g21.slice(0, 500) : 'not found');
