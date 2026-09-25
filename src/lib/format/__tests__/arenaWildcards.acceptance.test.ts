import { describe, expect, it } from 'vitest';
import { readRepoText } from '@/test/repoFs';
import {
  ARENA_WILDCARD_COST_PER_CARD,
  countArenaWildcardsNeeded,
  formatArenaWildcardNeedSummary,
} from '@/lib/format/arenaWildcards';

describe('Brawl Arena wildcard limits (replaces budget UI)', () => {
  it('DeckCustomizer shows Arena Wildcards instead of Budget Options for brawl100', async () => {
    const ui = await readRepoText('src/components/customization/DeckCustomizer.tsx');
    expect(/isBrawl/.test(ui)).toBe(true);
    expect(/Arena Wildcards/.test(ui)).toBe(true);
    expect(/ArenaWildcardLimitsPanel/.test(ui)).toBe(true);
  });

  it('switching to brawl100 clears paper budget fields in store', async () => {
    const store = await readRepoText('src/store/index.ts');
    expect(/formatMode === 'brawl100'[\s\S]*deckBudget = null/.test(store)).toBe(true);
    expect(/maxCardPrice = null/.test(store)).toBe(true);
    expect(/budgetOption = 'any'/.test(store)).toBe(true);
  });

  it('countArenaWildcardsNeeded sums one wildcard per missing card by rarity', () => {
    const cards = [
      { name: 'Shock', rarity: 'common' },
      { name: 'Shock', rarity: 'common' },
      { name: 'Sol Ring', rarity: 'uncommon' },
      { name: 'Sheoldred', rarity: 'mythic' },
    ];
    const owned = new Set(['shock']);
    const counts = countArenaWildcardsNeeded(cards, owned);
    expect(counts.common).toBe(0);
    expect(counts.uncommon).toBe(ARENA_WILDCARD_COST_PER_CARD.uncommon);
    expect(counts.mythic).toBe(ARENA_WILDCARD_COST_PER_CARD.mythic);
    expect(formatArenaWildcardNeedSummary(counts)).toBe('1 Mythic · 1 Uncommon');
  });
});
