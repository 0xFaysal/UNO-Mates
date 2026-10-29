const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's find every group enclosing each card rect.
// In Inkscape SVG, each card is inside a <g ...> ... </g>.
// Let's extract each card group and save an analysis of what shapes/paths/colors it has.

// Let's write an extractor that slices each card's XML.
// For each card border rect:
const rectRegex = /<rect\b[^>]*?(?:width="60"|width="240")[^>]*?>/g;
let match;
const cardSnippets = [];

// Better yet: in Inkscape, layer1 has direct children that are cards!
// Let's verify each direct child of layer1.
const layer1Start = svg.indexOf('<g\n     transform="translate(1261,748.63787)"\n     id="layer1">');
console.log('Layer1 start:', layer1Start);

// Let's parse layer1's direct children
let pos = svg.indexOf('>', layer1Start) + 1;
const layer1Children = [];

while (pos < svg.length) {
  // find next <g or </g>
  const nextOpen = svg.indexOf('<g', pos);
  const nextClose = svg.indexOf('</g>', pos);
  if (nextOpen === -1 && nextClose === -1) break;
  
  // If next is closing of layer1
  if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
    // End of layer1
    break;
  }
  
  // Start of child group
  let depth = 0;
  let childStart = nextOpen;
  let p = nextOpen;
  while (p < svg.length) {
    if (svg.startsWith('<g', p) && !svg.slice(p, p+10).includes('/>')) {
      depth++;
      p += 2;
    } else if (svg.startsWith('</g>', p)) {
      depth--;
      p += 4;
      if (depth === 0) {
        layer1Children.push(svg.slice(childStart, p));
        pos = p;
        break;
      }
    } else {
      p++;
    }
  }
}

console.log('Extracted layer1 direct children:', layer1Children.length);

// Now let's classify each child!
const classified = layer1Children.map((xml, idx) => {
  // Extract id
  const id = xml.match(/\bid="([^"]+)"/)?.[1];
  const transform = xml.match(/\btransform="([^"]+)"/)?.[1];
  
  // Fills
  const fills = [...new Set([...xml.matchAll(/fill:(#[0-9a-fA-F]{6})/g)].map(m => m[1]))];
  
  // Inner rect
  const innerRect = xml.match(/<rect\b[^>]*width="(?:50|200)"[^>]*>/);
  const innerFill = innerRect ? innerRect[0].match(/fill:(#[0-9a-fA-F]{6})/)?.[1] : null;

  // Let's see all text or path descriptions
  return {
    idx,
    id,
    transform,
    innerFill,
    fills,
    xmlLen: xml.length
  };
});

console.log('Sample classifications:');
console.log(classified.slice(0, 15));
console.log(classified.slice(90, 114));
