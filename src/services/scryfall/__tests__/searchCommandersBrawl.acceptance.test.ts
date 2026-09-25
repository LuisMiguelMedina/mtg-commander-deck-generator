import { describe, expect, it } from 'vitest';
import { readRepoText } from '@/test/repoFs';
import { isEligibleCommander } from '@/lib/format/formatMode';

describe('searchCommanders Brawl planeswalker commanders', () => {
  it('searchCommanders uses Brawl Arena query when formatMode is brawl100', async () => {
    const client = await readRepoText('src/services/scryfall/client.ts');
    expect(/searchCommanders\([\s\S]*formatMode/.test(client)).toBe(true);
    expect(/formatMode === 'brawl100'/.test(client)).toBe(true);
    expect(/BRAWL_ARENA_COMMANDER_SCRYFALL_QUERY/.test(client)).toBe(true);
  });

  it('CommanderSearch passes formatMode into searchCommanders', async () => {
    const ui = await readRepoText('src/components/commander/CommanderSearch.tsx');
    expect(/searchCommanders\(query,\s*\{\s*formatMode\s*\}/.test(ui)).toBe(true);
  });

  it('Brawl treats legendary planeswalkers as eligible commanders', () => {
    const pw = {
      name: 'Teferi, Hero of Dominaria',
      type_line: 'Legendary Planeswalker — Teferi',
      color_identity: ['W', 'U'],
    };
    expect(isEligibleCommander(pw, 'brawl100')).toBe(true);
    expect(isEligibleCommander(pw, 'commander')).toBe(false);
  });
});
