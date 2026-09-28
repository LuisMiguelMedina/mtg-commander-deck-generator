const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `: 'No themes selected'}`;
const replacement1 = `: customization.formatMode === 'brawl100' ? '' : 'No themes selected'}`;

content = content.replace(target1, replacement1);
content = content.replace(target1, replacement1);

fs.writeFileSync(path, content);
