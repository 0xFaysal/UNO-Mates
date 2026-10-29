const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

function parseXML(str) {
  let pos = 0;
  function skipWhitespace() {
    while (pos < str.length && /\s/.test(str[pos])) pos++;
  }
  function parseAttributes() {
    const attrs = {};
    while (pos < str.length) {
      skipWhitespace();
      if (str[pos] === '>' || str[pos] === '/' || str[pos] === '?') break;
      const keyMatch = str.slice(pos).match(/^[a-zA-Z0-9_\-:]+/);
      if (!keyMatch) break;
      const key = keyMatch[0];
      pos += key.length;
      skipWhitespace();
      if (str[pos] === '=') {
        pos++;
        skipWhitespace();
        const quote = str[pos];
        if (quote === '"' || quote === "'") {
          pos++;
          const valEnd = str.indexOf(quote, pos);
          attrs[key] = str.slice(pos, valEnd);
          pos = valEnd + 1;
        }
      } else {
        attrs[key] = true;
      }
    }
    return attrs;
  }

  function parseNode() {
    skipWhitespace();
    if (pos >= str.length) return null;
    if (str.startsWith('<!--', pos)) {
      const end = str.indexOf('-->', pos);
      pos = end + 3;
      return parseNode();
    }
    if (str.startsWith('<?', pos)) {
      const end = str.indexOf('?>', pos);
      pos = end + 2;
      return parseNode();
    }
    if (str[pos] !== '<') {
      const end = str.indexOf('<', pos);
      const text = end === -1 ? str.slice(pos) : str.slice(pos, end);
      pos = end === -1 ? str.length : end;
      return { type: 'text', value: text };
    }
    pos++;
    if (str[pos] === '/') {
      const end = str.indexOf('>', pos);
      const tagName = str.slice(pos + 1, end).trim();
      pos = end + 1;
      return { type: 'closing', tag: tagName };
    }
    const tagMatch = str.slice(pos).match(/^[a-zA-Z0-9_\-:]+/);
    if (!tagMatch) return null;
    const tag = tagMatch[0];
    pos += tag.length;
    const attrs = parseAttributes();
    skipWhitespace();
    let isSelfClosing = false;
    if (str[pos] === '/') {
      isSelfClosing = true;
      pos++;
    }
    if (str[pos] === '>') pos++;

    const children = [];
    if (!isSelfClosing) {
      while (pos < str.length) {
        skipWhitespace();
        if (str.startsWith('</' + tag, pos)) {
          const end = str.indexOf('>', pos);
          pos = end + 1;
          break;
        }
        const child = parseNode();
        if (child) {
          if (child.type === 'closing') {
            if (child.tag === tag) break;
          } else {
            children.push(child);
          }
        } else {
          break;
        }
      }
    }
    return { type: 'element', tag, attrs, children };
  }

  return parseNode();
}

function nodeToSvg(node) {
  if (node.type === 'text') return node.value;
  let s = `<${node.tag}`;
  if (node.attrs) {
    for (const [k, v] of Object.entries(node.attrs)) {
      s += ` ${k}="${v}"`;
    }
  }
  if (!node.children || node.children.length === 0) {
    s += ' />';
    return s;
  }
  s += '>';
  for (const c of node.children) {
    s += nodeToSvg(c);
  }
  s += `</${node.tag}>`;
  return s;
}

const root = parseXML(svg);

function findById(node, id) {
  if (node.attrs && node.attrs.id === id) return node;
  if (node.children) {
    for (const c of node.children) {
      const f = findById(c, id);
      if (f) return f;
    }
  }
  return null;
}

const layer1 = findById(root, 'layer1');
const groups = layer1.children.filter(c => c.tag === 'g');
console.log('Layer1 groups count:', groups.length);

// Let's analyze groups 0 to 114
const cardTypes = [];
groups.forEach((g, idx) => {
  // Let's find rects
  let rects = [];
  let paths = [];
  let texts = [];
  function walk(n) {
    if (n.tag === 'rect') rects.push(n);
    if (n.tag === 'path') paths.push(n);
    if (n.tag === 'text') texts.push(n);
    if (n.children) n.children.forEach(walk);
  }
  walk(g);
  
  // Find card dimensions
  const border60 = rects.find(r => r.attrs.width === '60');
  const border240 = rects.find(r => r.attrs.width === '240');
  
  // Find main color (usually inner rect width="50" or "200")
  let mainColor = 'unknown';
  const inner50 = rects.find(r => r.attrs.width === '50' || r.attrs.width === '200');
  if (inner50 && inner50.attrs.style) {
    const m = inner50.attrs.style.match(/fill:(#[0-9a-fA-F]{6})/);
    if (m) mainColor = m[1];
  }
  
  // If no inner rect, check fills in paths
  const fills = new Set();
  function getFills(n) {
    if (n.attrs && n.attrs.style) {
      const m = n.attrs.style.match(/fill:(#[0-9a-fA-F]{6})/);
      if (m) fills.add(m[1]);
    }
    if (n.children) n.children.forEach(getFills);
  }
  getFills(g);

  cardTypes.push({
    idx,
    id: g.attrs.id,
    transform: g.attrs.transform,
    border: border60 ? `60x90 at (${border60.attrs.x},${border60.attrs.y})` : border240 ? `240x360 at (${border240.attrs.x},${border240.attrs.y})` : 'none',
    mainColor,
    fills: Array.from(fills),
    rectCount: rects.length,
    pathCount: paths.length,
    textCount: texts.length,
    texts: texts.map(t => nodeToSvg(t))
  });
});

fs.writeFileSync('card_analysis.json', JSON.stringify(cardTypes, null, 2));
console.log('Saved card_analysis.json');

// Let's print summary by mainColor
const byColor = {};
cardTypes.forEach(c => {
  byColor[c.mainColor] = (byColor[c.mainColor] || 0) + 1;
});
console.log('Cards by main color:', byColor);
