import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryLoadSeam } from '@/test/loadSeam';
import { readRepoText } from '@/test/repoFs';

/**
 * PBI-MANA-50 acceptance (red until Fix Mana Pool lands-only rebalance exists).
 * docs/pbi/PBI-MANA-50-fix-mana-pool-lands-only.md
 *
 * At d2f2372 DeckDisplay has pip/production UI but no "Fix Mana Pool" button and
 * no fixManaPool seam. Spells must stay untouched; no generateDeck call.
 *
 * Intended seam `@/services/mana/fixManaPool`:
 *   fixManaPool({
 *     deckCards, formatMode, colorIdentity, pipDemand, sources, landTarget,
 *     rankLand, isBanned?,
 *   }) => { cards; changedLandNames }
 *   only mutates Land (incl. flex/MDFC land); non-land multiset identical
 *   never calls generateDeck; excludes banned/restricted
 */

const FIX_MODULE = '@/services/mana/fixManaPool';
const DISPLAY_PATH = 'src/components/deck/DeckDisplay.tsx';

type CardLike = {
  name: string;
  type_line: string;
  color_identity?: string[];
  produced_mana?: string[];
};

type FixInput = {
  deckCards: CardLike[];
  formatMode: string;
  colorIdentity: string[];
  pipDemand: Record<string, number>;
  sources: Record<string, number>;
  landTarget: number;
  rankLand: (card: CardLike) => number;
  isBanned?: (name: string) => boolean;
  generateDeck?: () => Promise<unknown>;
};

type FixResult = { cards: CardLike[]; changedLandNames: string[] };

function namesOf(cards: CardLike[], land: boolean): string[] {
  return cards
    .filter((c) => {
      const tl = (c.type_line ?? '').toLowerCase();
      const isLand = tl.includes('land');
      return land ? isLand : !isLand;
    })
    .map((c) => c.name)
    .sort();
}

async function loadFix(): Promise<((input: FixInput) => Promise<FixResult> | FixResult) | undefined> {
  const mod = await tryLoadSeam(FIX_MODULE);
  return mod?.fixManaPool as ((input: FixInput) => Promise<FixResult> | FixResult) | undefined;
}

describe('PBI-MANA-50 Fix Mana Pool: button + lands-only rebalance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fixManaPool seam exists', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
  });

  it('only mutates lands; non-land multiset stays identical', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    const deckCards: CardLike[] = [
      { name: 'Counterspell', type_line: 'Instant', color_identity: ['U'] },
      { name: 'Sol Ring', type_line: 'Artifact', color_identity: [] },
      { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
      { name: 'Swamp', type_line: 'Basic Land — Swamp', produced_mana: ['B'] },
      { name: 'Command Tower', type_line: 'Land', produced_mana: ['W', 'U', 'B', 'R', 'G'] },
    ];
    const nonLandBefore = namesOf(deckCards, false);

    const result = await fn({
      deckCards,
      formatMode: 'commander',
      colorIdentity: ['U', 'B'],
      pipDemand: { U: 8, B: 4 },
      sources: { U: 1, B: 1 },
      landTarget: 3,
      rankLand: (c) => (c.name === 'Command Tower' ? 100 : 10),
      isBanned: () => false,
    });

    expect(namesOf(result.cards, false)).toEqual(nonLandBefore);
    expect(result.cards.some((c) => c.name === 'Counterspell')).toBe(true);
    expect(result.cards.some((c) => c.name === 'Sol Ring')).toBe(true);
  });

  it('does not invoke generateDeck / regenerate', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    const generateDeck = vi.fn(async () => ({ cards: [] }));
    await fn({
      deckCards: [
        { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
        { name: 'Brainstorm', type_line: 'Instant', color_identity: ['U'] },
      ],
      formatMode: 'brawl100',
      colorIdentity: ['U'],
      pipDemand: { U: 6 },
      sources: { U: 1 },
      landTarget: 1,
      rankLand: () => 1,
      generateDeck,
    });

    expect(generateDeck).not.toHaveBeenCalled();
  });

  it('excludes banned/restricted land candidates', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    const result = await fn({
      deckCards: [
        { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
        { name: 'Brainstorm', type_line: 'Instant', color_identity: ['U'] },
      ],
      formatMode: 'commander',
      colorIdentity: ['U'],
      pipDemand: { U: 10 },
      sources: { U: 1 },
      landTarget: 2,
      rankLand: (c) => (c.name === 'Banned Lagoon' ? 999 : 1),
      isBanned: (name) => name === 'Banned Lagoon',
    });

    expect(result.cards.map((c) => c.name)).not.toContain('Banned Lagoon');
    expect(result.changedLandNames).not.toContain('Banned Lagoon');
  });

  it('DeckDisplay shows Fix Mana Pool under pip/mana demand (static red)', async () => {
    const source = await readRepoText(DISPLAY_PATH);

    expect(
      /Fix Mana Pool/.test(source),
      'DeckDisplay has no Fix Mana Pool button',
    ).toBe(true);
    expect(
      /fixManaPool\s*\(/.test(source),
      'DeckDisplay does not call fixManaPool',
    ).toBe(true);
  });
});
