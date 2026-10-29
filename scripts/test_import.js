const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Use the parser from parse_deck2
// Let's re-use the XML parser
const parseDeck2 = require('./parse_deck2.js');
