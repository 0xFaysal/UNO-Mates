const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's inspect the remaining children of layer1
const regex = /<g\b([^>]*)>([\s\S]*?)<\/g>/g;

// Let's check all children of layer1
const parseScript = `
const fs = require('fs');
const content = fs.readFileSync('UNO_cards_deck.svg', 'utf8');

// Find all elements inside layer1
const layer1Index = content.indexOf('id="layer1"');
const afterLayer1 = content.slice(layer1Index);

// Let's find each direct <g tag in layer1
let pos = 0;
const children = [];

// Let's match all <g that have id=
const gRegex = /<g\s+([^>]*id="([^"]+)"[^>]*)>/g;
let match;
while ((match = gRegex.exec(afterLayer1)) !== null) {
  // Let's see what is inside this group
}
`;
