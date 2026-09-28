const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `needsTheme={!primaryThemeSlug && !secondaryThemeSlug}`;
const replacement = `needsTheme={customization.formatMode !== 'brawl100' && !primaryThemeSlug && !secondaryThemeSlug}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
