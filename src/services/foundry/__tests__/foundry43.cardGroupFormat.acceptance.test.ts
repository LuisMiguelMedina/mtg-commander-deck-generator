import { describe, expect, it } from 'vitest';
import { readRepoText } from '@/test/repoFs';
import { isLegalForFormatDeck } from '@/services/scryfall/legality';
import { isEligibleCommander } from '@/lib/format/formatMode';

/**
 * Card-group discovery must respect the same formatMode as commander-first landing.
 */
describe('Card group search format split (Brawl vs Commander)', () => {
  it('HomePage gates CardGroupSearch behind format picker in cards mode', async () => {
    const home = await readRepoText('src/pages/HomePage.tsx');
    expect(/mode === 'cards'/.test(home)).toBe(true);
    expect(/Choose format/i.test(home)).toBe(true);
    expect(/CardGroupSearch[\s\S]*formatMode/.test(home)).toBe(true);
    expect(/landingModel\.step2Available/.test(home)).toBe(true);
  });

  it('CardGroupSearch filters commanders and seeds by format legality', async () => {
    const ui = await readRepoText('src/components/commander/CardGroupSearch.tsx');
    expect(/isEligibleCommander\(card, formatMode\)/.test(ui)).toBe(true);
    expect(/isLegalForFormatDeck/.test(ui)).toBe(true);
    expect(/formatMode === 'brawl100'/.test(ui)).toBe(true);
  });

  it('isLegalForFormatDeck applies Arena pool for brawl100', () => {
    const paperBrawl = {
      legalities: { brawl: 'legal' },
      games: ['paper'],
    };
    const arenaBrawl = {
      legalities: { brawl: 'legal' },
      games: ['arena'],
    };
    expect(isLegalForFormatDeck(paperBrawl, 'brawl100')).toBe(false);
    expect(isLegalForFormatDeck(arenaBrawl, 'brawl100')).toBe(true);
    expect(isLegalForFormatDeck(paperBrawl, 'commander')).toBe(false);
  });

  it('Brawl commanders include planeswalkers commander mode excludes', () => {
    const jace = {
      name: 'Jace, the Mind Sculptor',
      type_line: 'Legendary Planeswalker — Jace',
      color_identity: ['U'],
    };
    expect(isEligibleCommander(jace, 'commander')).toBe(false);
    expect(isEligibleCommander(jace, 'brawl100')).toBe(true);
  });
});
