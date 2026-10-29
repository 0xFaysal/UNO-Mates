const fs = require('fs');

const cards = JSON.parse(fs.readFileSync('card_analysis.json', 'utf-8'));
const blackCards = cards.filter(c => c.mainColor === '#000000');
console.log('--- 10 Black Cards ---');
blackCards.forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount} fills=${c.fills.join(',')}`);
});

console.log('\n--- 4 Unknown Cards ---');
cards.filter(c => c.mainColor === 'unknown').forEach(c => {
  console.log(`idx=${c.idx} id=${c.id} border=${c.border} rectCount=${c.rectCount} pathCount=${c.pathCount}`);
});
