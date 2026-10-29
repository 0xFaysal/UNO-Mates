const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's check if the text "UNO" exists anywhere in the SVG
console.log('Does "UNO" text exist?', svg.includes('UNO'));
console.log('Does "uno" text exist?', svg.toLowerCase().includes('uno'));

// Let's search for "text" or "tspan" tags
const textTags = svg.match(/<text[\s\S]*?<\/text>/g);
console.log('Text tags count:', textTags ? textTags.length : 0);
if (textTags) {
  textTags.forEach(t => console.log('Text:', t));
}
