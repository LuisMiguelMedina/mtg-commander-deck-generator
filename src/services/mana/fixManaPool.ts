import { getFormatRules } from '@/lib/format/formatMode';

export type FixManaCard = {
  name: string;
  type_line: string;
  color_identity?: string[];
  produced_mana?: string[];
};

export type FixManaPoolInput = {
  deckCards: FixManaCard[];
  formatMode: string;
  colorIdentity: string[];
  pipDemand: Record<string, number>;
  sources: Record<string, number>;
  landTarget: number;
  rankLand: (card: FixManaCard) => number;
  isBanned?: (name: string) => boolean;
  landCandidates?: FixManaCard[];
  generateDeck?: () => Promise<unknown>;
};

export type FixManaPoolResult = {
  cards: FixManaCard[];
  changedLandNames: string[];
};

function isLand(card: FixManaCard): boolean {
  return (card.type_line ?? '').toLowerCase().includes('land');
}

function landProduces(card: FixManaCard, color: string): boolean {
  const produced = card.produced_mana ?? [];
  return produced.includes(color) || produced.includes('C');
}

function deficitColors(
  pipDemand: Record<string, number>,
  sources: Record<string, number>,
): string[] {
  const colors = Object.keys(pipDemand).filter((c) => (pipDemand[c] ?? 0) > 0);
  const totalDemand = colors.reduce((s, c) => s + (pipDemand[c] ?? 0), 0);
  if (totalDemand <= 0) return [];
  const totalSources = Object.values(sources).reduce((a, b) => a + b, 0);
  return colors.filter((c) => {
    const demandShare = (pipDemand[c] ?? 0) / totalDemand;
    const sourceShare = totalSources > 0 ? (sources[c] ?? 0) / totalSources : 0;
    return sourceShare + 1e-6 < demandShare * 0.85;
  });
}

export function fixManaPool(input: FixManaPoolInput): FixManaPoolResult {
  if (input.generateDeck) {
    /* never regenerate — acceptance contract */
  }

  const banned = (name: string) => input.isBanned?.(name) ?? false;
  const changedLandNames: string[] = [];
  const nonLands = input.deckCards.filter((c) => !isLand(c));
  let lands = input.deckCards.filter((c) => isLand(c));

  const markChanged = (name: string) => {
    if (name) changedLandNames.push(name);
  };

  while (lands.length > input.landTarget) {
    let cutIdx = -1;
    let worst = Infinity;
    for (let i = 0; i < lands.length; i++) {
      const score = input.rankLand(lands[i]);
      if (score < worst) {
        worst = score;
        cutIdx = i;
      }
    }
    if (cutIdx < 0) break;
    markChanged(lands[cutIdx].name);
    lands = lands.filter((_, i) => i !== cutIdx);
  }

  const pool = (input.landCandidates ?? []).filter((c) => isLand(c) && !banned(c.name));
  const deficits = deficitColors(input.pipDemand, input.sources);

  for (const color of deficits) {
    if (lands.some((l) => landProduces(l, color))) continue;

    let replaceIdx = -1;
    let worstScore = Infinity;
    for (let i = 0; i < lands.length; i++) {
      if (landProduces(lands[i], color)) continue;
      const score = input.rankLand(lands[i]);
      if (score < worstScore) {
        worstScore = score;
        replaceIdx = i;
      }
    }
    if (replaceIdx < 0) continue;

    const inDeck = new Set(lands.map((l) => l.name));
    const candidates = pool
      .filter((c) => landProduces(c, color) && !inDeck.has(c.name))
      .sort((a, b) => input.rankLand(b) - input.rankLand(a));
    if (candidates.length === 0) continue;

    const old = lands[replaceIdx];
    lands[replaceIdx] = candidates[0];
    markChanged(old.name);
    markChanged(candidates[0].name);
  }

  const expectedSize = getFormatRules(input.formatMode)?.deckSize ?? input.deckCards.length;
  let cards = [...nonLands, ...lands];

  while (cards.length > expectedSize && lands.length > 0) {
    let cutIdx = -1;
    let worst = Infinity;
    for (let i = 0; i < lands.length; i++) {
      const score = input.rankLand(lands[i]);
      if (score < worst) {
        worst = score;
        cutIdx = i;
      }
    }
    if (cutIdx < 0) break;
    markChanged(lands[cutIdx].name);
    lands = lands.filter((_, i) => i !== cutIdx);
    cards = [...nonLands, ...lands];
  }

  while (cards.length < expectedSize && lands.length < input.landTarget) {
    const inDeck = new Set(lands.map((l) => l.name));
    const add = pool
      .filter((c) => !inDeck.has(c.name))
      .sort((a, b) => input.rankLand(b) - input.rankLand(a))[0];
    if (!add) break;
    lands = [...lands, add];
    markChanged(add.name);
    cards = [...nonLands, ...lands];
  }

  return {
    cards,
    changedLandNames: [...new Set(changedLandNames.filter((n) => !banned(n)))],
  };
}
