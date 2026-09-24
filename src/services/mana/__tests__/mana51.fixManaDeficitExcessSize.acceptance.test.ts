import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFormatRules } from '@/lib/format/formatMode';
import { tryLoadSeam } from '@/test/loadSeam';

/**
 * PBI-MANA-51 acceptance (red until deficit/excess + 1+99 + dual formatMode).
 * docs/pbi/PBI-MANA-51-fix-mana-deficit-excess-size.md
 *
 * Same fixManaPool seam as PBI-50. At d2f2372 the seam is missing → intentional red.
 *
 *   deficit → swap/add flex lands covering missing colors
 *   excess lands vs target → cut worst score/fit
 *   non-commander maindeck size = getFormatRules(formatMode).deckSize (99)
 *   works for commander and brawl100; non-lands unchanged
 */

const FIX_MODULE = '@/services/mana/fixManaPool';

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
  landCandidates?: CardLike[];
};

type FixResult = { cards: CardLike[]; changedLandNames: string[] };

function isLand(card: CardLike): boolean {
  return (card.type_line ?? '').toLowerCase().includes('land');
}

function nonLandNames(cards: CardLike[]): string[] {
  return cards.filter((c) => !isLand(c)).map((c) => c.name).sort();
}

function landCount(cards: CardLike[]): number {
  return cards.filter(isLand).length;
}

function buildMaindeck(formatMode: string, extras: CardLike[]): CardLike[] {
  const size = getFormatRules(formatMode)?.deckSize ?? 99;
  const spells: CardLike[] = Array.from({ length: size - extras.filter(isLand).length }, (_, i) => ({
    name: `Spell ${i + 1}`,
    type_line: 'Instant',
    color_identity: ['U'],
  }));
  // Keep deck at deckSize non-commander cards: replace trailing spells with lands in extras
  const landExtras = extras.filter(isLand);
  const spellCount = size - landExtras.length;
  return [...spells.slice(0, spellCount), ...landExtras];
}

async function loadFix(): Promise<((input: FixInput) => Promise<FixResult> | FixResult) | undefined> {
  const mod = await tryLoadSeam(FIX_MODULE);
  return mod?.fixManaPool as ((input: FixInput) => Promise<FixResult> | FixResult) | undefined;
}

describe('PBI-MANA-51 Fix Mana: deficit/excess + size 1+99 + dual formatMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deficit adds or swaps flex lands covering missing colors', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    const deckCards = buildMaindeck('commander', [
      { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
      { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
    ]);
    // Unique names for basics in test fixture — rebuild with distinct land rows
    const lands: CardLike[] = [
      { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
      { name: 'Mountain', type_line: 'Basic Land — Mountain', produced_mana: ['R'] },
    ];
    const size = getFormatRules('commander')!.deckSize;
    const spells: CardLike[] = Array.from({ length: size - lands.length }, (_, i) => ({
      name: `Spell ${i + 1}`,
      type_line: 'Instant',
      color_identity: ['U', 'B'],
    }));
    const inputDeck = [...spells, ...lands];
    const beforeNonLands = nonLandNames(inputDeck);

    const result = await fn({
      deckCards: inputDeck,
      formatMode: 'commander',
      colorIdentity: ['U', 'B'],
      pipDemand: { U: 10, B: 8 },
      sources: { U: 1, B: 0 },
      landTarget: lands.length,
      rankLand: (c) => (c.produced_mana?.includes('B') ? 50 : 5),
      landCandidates: [
        { name: 'Watery Grave', type_line: 'Land — Island Swamp', produced_mana: ['U', 'B'] },
        { name: 'Command Tower', type_line: 'Land', produced_mana: ['W', 'U', 'B', 'R', 'G'] },
      ],
    });

    expect(nonLandNames(result.cards)).toEqual(beforeNonLands);
    expect(result.cards.some((c) => (c.produced_mana ?? []).includes('B') && isLand(c))).toBe(true);
    expect(result.changedLandNames.length).toBeGreaterThan(0);
  });

  it('excess lands vs target cuts worst score / color fit', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    const size = getFormatRules('commander')!.deckSize;
    const lands: CardLike[] = [
      { name: 'Command Tower', type_line: 'Land', produced_mana: ['W', 'U', 'B', 'R', 'G'] },
      { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
      { name: 'Wastes', type_line: 'Basic Land', produced_mana: ['C'] },
      { name: 'Snow-Covered Mountain', type_line: 'Basic Snow Land — Mountain', produced_mana: ['R'] },
    ];
    const landTarget = 2;
    const spells: CardLike[] = Array.from({ length: size - lands.length }, (_, i) => ({
      name: `Spell ${i + 1}`,
      type_line: 'Sorcery',
      color_identity: ['U'],
    }));
    const inputDeck = [...spells, ...lands];

    const result = await fn({
      deckCards: inputDeck,
      formatMode: 'commander',
      colorIdentity: ['U'],
      pipDemand: { U: 6 },
      sources: { U: 2, C: 1, R: 1 },
      landTarget,
      rankLand: (c) => {
        if (c.name === 'Command Tower') return 100;
        if (c.name === 'Island') return 40;
        if (c.name === 'Wastes') return 5;
        return 1;
      },
    });

    expect(landCount(result.cards)).toBe(landTarget);
    expect(result.cards.some((c) => c.name === 'Command Tower')).toBe(true);
    expect(result.cards.some((c) => c.name === 'Snow-Covered Mountain')).toBe(false);
  });

  it('preserves getFormatRules(formatMode).deckSize for commander and brawl100', async () => {
    const fn = await loadFix();
    expect(typeof fn, `${FIX_MODULE} fixManaPool`).toBe('function');
    if (typeof fn !== 'function') return;

    for (const formatMode of ['commander', 'brawl100'] as const) {
      const size = getFormatRules(formatMode)!.deckSize;
      expect(size).toBe(99);
      const lands: CardLike[] = [
        { name: 'Island', type_line: 'Basic Land — Island', produced_mana: ['U'] },
        { name: 'Swamp', type_line: 'Basic Land — Swamp', produced_mana: ['B'] },
      ];
      const spells: CardLike[] = Array.from({ length: size - lands.length }, (_, i) => ({
        name: `Spell ${formatMode}-${i}`,
        type_line: 'Instant',
        color_identity: ['U', 'B'],
      }));
      const inputDeck = [...spells, ...lands];
      const beforeNonLands = nonLandNames(inputDeck);

      const result = await fn({
        deckCards: inputDeck,
        formatMode,
        colorIdentity: ['U', 'B'],
        pipDemand: { U: 5, B: 5 },
        sources: { U: 1, B: 1 },
        landTarget: 2,
        rankLand: () => 10,
        landCandidates: [
          { name: 'Watery Grave', type_line: 'Land — Island Swamp', produced_mana: ['U', 'B'] },
        ],
      });

      expect(result.cards.length).toBe(size);
      expect(nonLandNames(result.cards)).toEqual(beforeNonLands);
    }
  });
});
