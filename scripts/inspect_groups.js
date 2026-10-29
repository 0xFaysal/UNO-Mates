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
console.log('Total layer1 groups:', groups.length);

// Let's inspect each of the 114 groups
const cardInfos = [];
for (let i = 0; i < groups.length; i++) {
  const g = groups[i];
  let rects = [];
  let paths = [];
  let texts = [];
  function collect(n) {
    if (n.tag === 'rect') rects.push(n);
    if (n.tag === 'path') paths.push(n);
    if (n.tag === 'text') texts.push(n);
    if (n.children) n.children.forEach(collect);
  }
  collect(g);

  // find colors in rects and paths
  const fills = new Set();
  function collectFills(n) {
    const s = n.attrs ? n.attrs.style || '' : '';
    const m = s.match(/fill:(#[0-9a-fA-F]{6})/);
    if (m) fills.add(m[1]);
    if (n.children) n.children.forEach(collectFills);
  }
  collectFills(g);

  const rect60 = rects.find(r => r.attrs.width === '60' && r.attrs.height === '90');
  cardInfos.push({
    index: i,
    id: g.attrs.id,
    transform: g.attrs.transform,
    hasRect60: !!rect60,
    rectX: rect60 ? rect60.attrs.x : null,
    rectY: rect60 ? rect60.attrs.y : null,
    rectCount: rects.length,
    pathCount: paths.length,
    fills: Array.from(fills)
  });
}

const nonRect60 = cardInfos.filter(c => !c.hasRect60);
console.log('Groups without 60x90 rect (' + nonRect60.length + '):');
console.log(nonRect60);
