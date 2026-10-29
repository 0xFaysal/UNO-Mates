const fs = require('fs');

const svgContent = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Let's parse all top-level or second-level groups in layer1
// In the SVG:
// <g transform="translate(1261,748.63787)" id="layer1">
// Inside layer1, what groups exist?

// Let's write a parser that parses XML properly
const parseGroups = () => {
  // Simple XML group extractor
  const groupMatches = svgContent.match(/<g\b[^>]*id="([a-zA-Z0-9_\-]+)"[^>]*>[\s\S]*?<\/g>/g);
  console.log('Found groups:', groupMatches ? groupMatches.length : 0);
};

// Let's write a script that inspects the hierarchy of layer1
const layer1Match = svgContent.match(/<g[^>]*id="layer1"[^>]*>([\s\S]*)<\/svg>/);
if (layer1Match) {
  const inner = layer1Match[1];
  // Find all direct children of layer1
  // They are either <g ...>...</g>
  // Let's count them
  console.log('Layer1 length:', inner.length);
}

// Let's list each card and find what's rendered in it
// Notice how each card has rect width="60" height="90" x="..." y="..."
// Let's write a small node script with an xml parser or DOM parser
