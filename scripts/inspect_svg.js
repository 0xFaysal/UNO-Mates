const fs = require('fs');

const svgContent = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

console.log('SVG length:', svgContent.length);
// Find all <g elements that contain width="60" and height="90"
const regex = /<g\b[^>]*>[\s\S]*?<rect\b[^>]*width="60"[^>]*height="90"[^>]*\/>[\s\S]*?<\/g>/g;

// Let's inspect the SVG with a parser or regex
const matches = svgContent.match(/<g\b[^>]*id="([a-zA-Z0-9_\-]+)"[^>]*>/g);
console.log('Total <g> tags with id:', matches ? matches.length : 0);

// Let's search for fills
const fills = new Set();
const fillRegex = /fill:(#[0-9a-fA-F]{6})/g;
let m;
while ((m = fillRegex.exec(svgContent)) !== null) {
  fills.add(m[1]);
}
console.log('Unique fills in SVG:', Array.from(fills));

// Let's see unique card rect coordinates
const rectRegex = /<rect[^>]*width="60"[^>]*height="90"[^>]*x="([^"]+)"[^>]*y="([^"]+)"/g;
const coords = [];
while ((m = rectRegex.exec(svgContent)) !== null) {
  coords.push({ x: m[1], y: m[2] });
}
console.log('Total 60x90 rects:', coords.length);
console.log('Sample coords:', coords.slice(0, 15));

// Check coordinates grid
const xs = [...new Set(coords.map(c => c.x))].sort((a,b) => parseFloat(a) - parseFloat(b));
const ys = [...new Set(coords.map(c => c.y))].sort((a,b) => parseFloat(a) - parseFloat(b));
console.log('Unique X coords (' + xs.length + '):', xs);
console.log('Unique Y coords (' + ys.length + '):', ys);
