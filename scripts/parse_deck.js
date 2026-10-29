const fs = require('fs');

const svgContent = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Match all <g ... id="g..." ...> ... </g> that define a card
// Let's find all tags that contain <rect ... width="60" height="90" ... />
// Note that some groups might be nested. Let's find each card container.

const lines = svgContent.split('\n');
console.log('Total lines:', lines.length);

// Let's find groups with id="g\d+" and check their bounds and contents
const cardGroups = [];
let currentGroup = null;
let currentGroupLines = [];
let depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<g') && !line.includes('/>')) {
    depth++;
  }
  if (line.includes('</g>')) {
    depth--;
  }
}
console.log('Depth check balanced:', depth === 0);

// Let's locate each rect with width="60" height="90" and its surrounding group
const cardPattern = /<g\b([^>]*)>([\s\S]*?)<\/g>/g;

// Let's use an XML parser by installing fast-xml-parser or writing a clean tokenizer
