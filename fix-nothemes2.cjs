const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /: customization\.formatMode === 'brawl100' \? '' : customization\.formatMode === 'brawl100' \? '' : 'No themes selected'}/g;
content = content.replace(regex, `: customization.formatMode === 'brawl100' ? '' : 'No themes selected'}`);

fs.writeFileSync(path, content);
