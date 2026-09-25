import { describe, expect, it } from 'vitest';
import { readRepoText } from '@/test/repoFs';

describe('Brawl100 builder archetype (acceptance)', () => {
  it('BuilderPage loads Moxfield popularity for brawl100 instead of EDHREC themes on commander load', async () => {
    const source = await readRepoText('src/pages/BuilderPage.tsx');
    expect(/formatMode === 'brawl100'/.test(source)).toBe(true);
    expect(/fetchBrawl100ArchetypePopularity/.test(source)).toBe(true);
    expect(/setArchetypePopularityContext/.test(source)).toBe(true);
    const brawlBlock = source.slice(
      source.indexOf("if (formatMode === 'brawl100')"),
      source.indexOf('// Fetch EDHREC themes (Commander)'),
    );
    expect(/fetchCommanderData/.test(brawlBlock)).toBe(false);
  });

  it('ArchetypeDisplay does not show EDHREC failure copy for brawl100', async () => {
    const source = await readRepoText('src/components/archetype/ArchetypeDisplay.tsx');
    expect(/!isBrawl && themesError/.test(source)).toBe(true);
    expect(/Historic Brawl suggestions use popular public decks on Moxfield/.test(source)).toBe(true);
  });
});
