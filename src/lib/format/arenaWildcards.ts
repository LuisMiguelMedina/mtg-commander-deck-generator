import type { Rarity } from '@/types';

/** MTG Arena: crafting a missing card costs one wildcard of that card's rarity (singleton Brawl ⇒ max one WC per card name). */
export const ARENA_WILDCARD_COST_PER_CARD: Record<Rarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 1,
  mythic: 1,
};

/** Historic Brawl on Arena — singleton; each wildcard spend is tied to a single card slot. */
export const ARENA_BRAWL_MAX_COPIES_PER_CARD = 1;

export type ArenaWildcardLimitRow = {
  rarity: Rarity;
  label: string;
  wildcardLabel: string;
  perCardLimit: string;
};

export function brawlArenaWildcardLimitRows(): ArenaWildcardLimitRow[] {
  return [
    {
      rarity: 'common',
      label: 'Common',
      wildcardLabel: '1× Common Wildcard',
      perCardLimit: `${ARENA_BRAWL_MAX_COPIES_PER_CARD} copy / card (singleton)`,
    },
    {
      rarity: 'uncommon',
      label: 'Uncommon',
      wildcardLabel: '1× Uncommon Wildcard',
      perCardLimit: `${ARENA_BRAWL_MAX_COPIES_PER_CARD} copy / card (singleton)`,
    },
    {
      rarity: 'rare',
      label: 'Rare',
      wildcardLabel: '1× Rare Wildcard',
      perCardLimit: `${ARENA_BRAWL_MAX_COPIES_PER_CARD} copy / card (singleton)`,
    },
    {
      rarity: 'mythic',
      label: 'Mythic Rare',
      wildcardLabel: '1× Mythic Wildcard',
      perCardLimit: `${ARENA_BRAWL_MAX_COPIES_PER_CARD} copy / card (singleton)`,
    },
  ];
}

function normalizeArenaRarity(raw?: string): Rarity | null {
  const r = (raw ?? '').toLowerCase();
  if (r === 'common' || r === 'uncommon' || r === 'rare' || r === 'mythic') return r;
  return null;
}

/** Count how many Arena wildcards of each tier a deck would need to craft (cards not in `ownedNames`). */
export function countArenaWildcardsNeeded(
  cards: Array<{ name: string; rarity?: string }>,
  ownedNames?: Set<string>,
): Record<Rarity, number> {
  const out: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  const seen = new Set<string>();
  for (const card of cards) {
    const key = card.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rarity = normalizeArenaRarity(card.rarity);
    if (!rarity) continue;
    if (ownedNames?.has(key)) continue;
    out[rarity] += ARENA_WILDCARD_COST_PER_CARD[rarity];
  }
  return out;
}

export function formatArenaWildcardNeedSummary(counts: Record<Rarity, number>): string | null {
  const parts: string[] = [];
  const labels: Record<Rarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    mythic: 'Mythic',
  };
  for (const rarity of ['mythic', 'rare', 'uncommon', 'common'] as Rarity[]) {
    if (counts[rarity] > 0) parts.push(`${counts[rarity]} ${labels[rarity]}`);
  }
  return parts.length ? parts.join(' · ') : null;
}
