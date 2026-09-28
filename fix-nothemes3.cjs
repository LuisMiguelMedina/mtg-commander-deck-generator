const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `: 'No themes selected'}`;
const replacement = `: customization.formatMode === 'brawl100' ? '' : 'No themes selected'}`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
