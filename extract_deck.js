const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Function to extract a group by its ID
function extractGroupById(id) {
  const marker = `id="${id}"`;
  const idx = svg.indexOf(marker);
  if (idx === -1) return null;
  const start = svg.lastIndexOf('<g', idx);
  let pos = start;
  let depth = 0;
  while (pos < svg.length) {
    if (svg.startsWith('<g', pos) && !svg.slice(pos, pos+10).includes('/>')) {
      depth++;
      pos += 2;
    } else if (svg.startsWith('</g>', pos)) {
      depth--;
      pos += 4;
      if (depth === 0) {
        return svg.slice(start, pos);
      }
    } else {
      pos++;
    }
  }
  return null;
}

// Card mappings:
// In the 60x90 coordinate space:
// For row y=332.36218:
// x=0: 0
// x=60: 1
// x=120: 2
// x=180: 3
// x=240: 4
// x=300: 5
// x=360: 6
// x=420: 7
// x=480: 8
// x=540: 9
// x=600: skip
// x=660: reverse

// For Draw Two:
// Red: g9420 at x=915, y=692.36218
// Yellow: g9433 at x=915, y=782.36218
// Green: g9446 at x=915, y=872.36218
// Blue: g9459 at x=915, y=962.36218

// For Wild Draw Four:
// g6694 at x=780, y=692.36218

// For Wild:
// g9888 at x=1860, y=-747.63776 (in 240x360 coordinates)

// Let's verify groups for each color:
// Red 0..9, skip, reverse:
const redIds = {
  '0': 'g6555',
  '1': 'g6563',
  '2': 'g6571',
  '3': 'g6579',
  '4': 'g6587',
  '5': 'g6595',
  '6': 'g6603',
  '7': 'g6611',
  '8': 'g6619',
  '9': 'g6627',
  'skip': 'g6635',
  'reverse': 'g6643',
  'draw2': 'g9420'
};

const yellowIds = {
  '0': 'g6555-0',
  '1': 'g6563-5',
  '2': 'g6571-0',
  '3': 'g6579-6',
  '4': 'g6587-1',
  '5': 'g6595-7',
  '6': 'g6603-6',
  '7': 'g6611-5',
  '8': 'g6619-5',
  '9': 'g6627-8',
  'skip': 'g6635-3',
  'reverse': 'g6643-8',
  'draw2': 'g9433'
};

const greenIds = {
  '0': 'g6555-7',
  '1': 'g6563-3',
  '2': 'g6571-2',
  '3': 'g6579-7',
  '4': 'g6587-7',
  '5': 'g6595-1',
  '6': 'g6603-5',
  '7': 'g6611-7',
  '8': 'g6619-6',
  '9': 'g6627-0',
  'skip': 'g6635-7',
  'reverse': 'g6643-0',
  'draw2': 'g9446'
};

const blueIds = {
  '0': 'g6555-6',
  '1': 'g6563-2',
  '2': 'g6571-4',
  '3': 'g6579-3',
  '4': 'g6587-5',
  '5': 'g6595-4',
  '6': 'g6603-2',
  '7': 'g6611-6',
  '8': 'g6619-3',
  '9': 'g6627-83',
  'skip': 'g6635-9',
  'reverse': 'g6643-5',
  'draw2': 'g9459'
};

const colors = [
  { name: 'red', ids: redIds },
  { name: 'yellow', ids: yellowIds },
  { name: 'green', ids: greenIds },
  { name: 'blue', ids: blueIds }
];

const outputDir = path.join(__dirname, 'extracted_cards');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

function cleanGroupXml(xml, is240 = false) {
  // Strip transform attribute from the outermost group
  let cleaned = xml.replace(/^<g\b[^>]*>/, (match) => {
    return match.replace(/\s*transform="[^"]*"/, '');
  });
  return cleaned;
}

// Generate standalone SVGs
const catalog = [];

for (const { name: color, ids } of colors) {
  for (const [val, id] of Object.entries(ids)) {
    const rawXml = extractGroupById(id);
    if (!rawXml) {
      console.error(`Group not found for ${color}_${val} (${id})`);
      continue;
    }
    // Find rect with width="60"
    const m = rawXml.match(/<rect\b[^>]*width="60"[^>]*height="90"[^>]*x="([^"]+)"[^>]*y="([^"]+)"/);
    if (!m) {
      console.error(`Rect 60x90 not found for ${color}_${val} (${id})`);
      continue;
    }
    const x = m[1];
    const y = m[2];
    const viewBox = `${x} ${y} 60 90`;
    const cleaned = cleanGroupXml(rawXml, false);
    
    const svgFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="240" height="360">\n${cleaned}\n</svg>`;
    const fileName = `${color}_${val}.svg`;
    fs.writeFileSync(path.join(outputDir, fileName), svgFile);
    catalog.push({ color, value: val, file: fileName });
  }
}

// Wild Draw Four
{
  const rawXml = extractGroupById('g6694');
  const m = rawXml.match(/<rect\b[^>]*width="60"[^>]*height="90"[^>]*x="([^"]+)"[^>]*y="([^"]+)"/);
  const x = m[1];
  const y = m[2];
  const viewBox = `${x} ${y} 60 90`;
  const cleaned = cleanGroupXml(rawXml, false);
  const svgFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="240" height="360">\n${cleaned}\n</svg>`;
  fs.writeFileSync(path.join(outputDir, 'wild_draw4.svg'), svgFile);
  catalog.push({ color: 'wild', value: 'draw4', file: 'wild_draw4.svg' });
}

// Wild
{
  const rawXml = extractGroupById('g9888');
  const m = rawXml.match(/<rect\b[^>]*width="240"[^>]*height="360"[^>]*x="([^"]+)"[^>]*y="([^"]+)"/);
  const x = m[1];
  const y = m[2];
  const viewBox = `${x} ${y} 240 360`;
  const cleaned = cleanGroupXml(rawXml, true);
  const svgFile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="240" height="360">\n${cleaned}\n</svg>`;
  fs.writeFileSync(path.join(outputDir, 'wild.svg'), svgFile);
  catalog.push({ color: 'wild', value: 'wild', file: 'wild.svg' });
}

// Card Back
{
  // A beautiful, classic UNO card back matching the deck proportions (240x360, rx=40)
  const cardBackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360" width="240" height="360">
  <defs>
    <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a24" />
      <stop offset="100%" stop-color="#0a0a0f" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>
  <!-- White border -->
  <rect width="240" height="360" rx="40" ry="40" x="0" y="0" style="fill:#ffffff;stroke:#000000;stroke-width:2;" />
  <!-- Dark card body -->
  <rect width="200" height="320" rx="20" ry="20" x="20" y="20" style="fill:url(#backGrad);" />
  <!-- Center Red Oval angled -->
  <g transform="translate(120, 180) rotate(-28)">
    <ellipse cx="0" cy="0" rx="88" ry="46" style="fill:#ff5555;stroke:#ffffff;stroke-width:3;" />
    <!-- UNO text -->
    <text x="0" y="16" font-family="'Arial Black', Impact, sans-serif" font-weight="900" font-style="italic" font-size="46" fill="#ffaa00" text-anchor="middle" stroke="#000000" stroke-width="3" paint-order="stroke fill" filter="url(#shadow)">UNO</text>
  </g>
</svg>`;
  fs.writeFileSync(path.join(outputDir, 'card_back.svg'), cardBackSvg);
  catalog.push({ color: 'special', value: 'back', file: 'card_back.svg' });
}

console.log(`Successfully extracted ${catalog.length} card assets to extracted_cards/`);

// Generate an HTML preview gallery to visually verify all cards!
let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>UNO Deck Preview Gallery</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; }
    h1 { text-align: center; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 16px; max-width: 1400px; margin: 0 auto; }
    .card-box { background: #1e293b; border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); transition: transform 0.2s; }
    .card-box:hover { transform: translateY(-4px); }
    .card-box img { width: 100%; height: auto; border-radius: 8px; display: block; }
    .label { margin-top: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>UNO Classic Deck Assets (Total: ${catalog.length})</h1>
  <div class="grid">
`;

for (const item of catalog) {
  html += `    <div class="card-box">
      <img src="${item.file}" alt="${item.color} ${item.value}" />
      <div class="label">${item.color} ${item.value}</div>
    </div>\n`;
}

html += `  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'index.html'), html);
console.log('Saved preview gallery to extracted_cards/index.html');
