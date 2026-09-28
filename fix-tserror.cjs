const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `customization.formatMode === 'brawl100' ? '' : customization.formatMode === 'brawl100' ? '' : 'No themes selected'`;
const replacement1 = `(customization.formatMode as string) === 'brawl100' ? '' : 'No themes selected'`;
content = content.replace(target1, replacement1);

const target2 = `needsTheme={customization.formatMode !== 'brawl100' && !primaryThemeSlug && !secondaryThemeSlug}`;
const replacement2 = `needsTheme={(customization.formatMode as string) !== 'brawl100' && !primaryThemeSlug && !secondaryThemeSlug}`;
content = content.replace(target2, replacement2);

fs.writeFileSync(path, content);
