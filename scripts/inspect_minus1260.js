const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's find rect2987-1-7-3 and see what element it's in
const idx = svg.indexOf('rect2987-1-7-3');
console.log('rect2987-1-7-3 found at:', idx);
const snippet = svg.slice(Math.max(0, idx - 200), idx + 800);
console.log(snippet);
