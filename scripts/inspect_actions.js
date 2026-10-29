const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

function getGroup(id) {
  const marker = `id="${id}"`;
  const idx = svg.indexOf(marker);
  const start = svg.lastIndexOf('<g', idx);
  // find closing </g>
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

console.log('--- g6635 (x=600) ---');
console.log(getGroup('g6635'));

console.log('--- g6643 (x=660) ---');
console.log(getGroup('g6643'));
