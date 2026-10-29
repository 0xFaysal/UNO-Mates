const fs = require('fs');
const content = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

function getGroup(id) {
  const start = content.indexOf(`id="${id}"`);
  if (start === -1) return null;
  // find start of <g
  const gStart = content.lastIndexOf('<g', start);
  // find matching </g>
  let pos = gStart;
  let depth = 0;
  while (pos < content.length) {
    if (content.startsWith('<g', pos) && !content.slice(pos, pos+10).includes('/>')) {
      depth++;
      pos += 2;
    } else if (content.startsWith('</g>', pos)) {
      depth--;
      pos += 4;
      if (depth === 0) {
        return content.slice(gStart, pos);
      }
    } else {
      pos++;
    }
  }
  return null;
}

console.log('--- Group g9888 (first 1000 chars) ---');
console.log(getGroup('g9888')?.slice(0, 1000));

console.log('--- Group g6111-64-0-9-1 ---');
console.log(getGroup('g6111-64-0-9-1'));
