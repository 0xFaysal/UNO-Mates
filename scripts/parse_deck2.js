const fs = require('fs');

const svg = fs.readFileSync('UNO_cards_deck.svg', 'utf-8');

// Simple XML parser
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
    // Tag
    pos++; // skip <
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

const root = parseXML(svg);

// Find layer1
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
console.log('Layer1 found. Direct children count:', layer1 ? layer1.children.filter(c => c.tag === 'g').length : 0);

// Inspect all direct child groups of layer1
const cards = [];
if (layer1) {
  for (const g of layer1.children.filter(c => c.tag === 'g')) {
    // Check if it has a rect with width 60 and height 90
    let rect60 = null;
    let innerColor = null;
    function checkRect(n) {
      if (n.tag === 'rect' && n.attrs.width === '60' && n.attrs.height === '90') {
        rect60 = n;
      }
      if (n.tag === 'rect' && n.attrs.width === '50' && n.attrs.height === '80') {
        // usually inner colored rect
        const style = n.attrs.style || '';
        const m = style.match(/fill:(#[0-9a-fA-F]{6})/);
        if (m) innerColor = m[1];
      }
      if (n.children) {
        for (const c of n.children) checkRect(c);
      }
    }
    checkRect(g);
    if (rect60) {
      cards.push({
        id: g.attrs.id,
        transform: g.attrs.transform,
        x: rect60.attrs.x,
        y: rect60.attrs.y,
        color: innerColor,
        childCount: g.children.length
      });
    }
  }
}
console.log('Total card groups matched:', cards.length);
// Group by y coordinate
const byY = {};
for (const c of cards) {
  byY[c.y] = byY[c.y] || [];
  byY[c.y].push(c);
}
for (const [y, list] of Object.entries(byY)) {
  console.log(`\nRow y=${y} (count: ${list.length}):`);
  list.sort((a,b) => parseFloat(a.x) - parseFloat(b.x));
  console.log(list.map(c => `x=${c.x} id=${c.id} color=${c.color}`).join(' | '));
}
