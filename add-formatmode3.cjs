const fs = require('fs');
const path = 'src/pages/BuilderPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `const newList = createList(deckName, allCards, '', {
      type: 'deck',
      commanderName: commander.name,`;
const replacement = `const newList = createList(deckName, allCards, '', {
      type: 'deck',
      formatMode: customization.formatMode,
      commanderName: commander.name,`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
