const fs = require('fs');
const path = 'src/components/deck/optimizer/DeckOptimizer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `: await fetchCommanderData(commanderName, undefined, undefined, colorSeg);`;
const replacement = `: await fetchCommanderData(commanderName, undefined, undefined, colorSeg);

        if (edhrecData.cardlists && edhrecData.cardlists.allNonLand.length === 0 && !partnerCommanderName) {
          try {
            const { searchBrawl100Decks } = await import('@/services/moxfield/client');
            const brawlData = await searchBrawl100Decks(commanderName);
            if (brawlData.cards && brawlData.cards.length > 0) {
              edhrecData.cardlists.allNonLand = brawlData.cards.map(c => ({
                name: c.name,
                sanitized: c.name,
                inclusion: c.inclusion ?? 0,
                num_decks: c.count ?? 0,
                primary_type: 'Unknown',
              }));
              edhrecData.stats.numDecks = brawlData.numDecks ?? brawlData.cards.length;
            }
          } catch (e) {
            console.warn('[DeckOptimizer] Brawl fallback failed', e);
          }
        }`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content);
