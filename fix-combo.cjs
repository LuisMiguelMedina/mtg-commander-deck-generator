const fs = require('fs');
const lines = fs.readFileSync('src/services/spellbook/comboIndex.ts', 'utf8').split('\n');
lines[86] = '      console.log(`[Spellbook] Combo index unavailable for ${slug} - falling back to EDHREC page`);';
fs.writeFileSync('src/services/spellbook/comboIndex.ts', lines.join('\n'));
