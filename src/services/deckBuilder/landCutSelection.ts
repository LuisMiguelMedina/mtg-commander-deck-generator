// src/services/deckBuilder/landCutSelection.ts
import type { ScryfallCard } from '@/types';
import type { AnalyzedCard, ColorFixingAnalysis } from './deckAnalyzer';

const BASIC_FETCH_RE = /search(?:es)?\s+(?:your|their)\s+library\s+for\s+(?:up\s+to\s+\w+\s+)?(?:a\s+)?basic\s+(?:land|forest|island|swamp|mountain|plains)/i;

/** Count cards whose oracle text searches the library for a basic land. */
export function countBasicFetchers(cards: ScryfallCard[]): number {
  let n = 0;
  for (const c of cards) {
    const oracle = c.oracle_text || c.card_faces?.[0]?.oracle_text || '';
    if (BASIC_FETCH_RE.test(oracle)) n++;
  }
  return n;
}

/** Minimum basics to keep so basic-fetchers (Cultivate etc.) have live targets. */
export function computeBasicFloor(basicFetcherCount: number): number {
  return Math.max(2, basicFetcherCount * 2);
}

export type LandCutKind = 'basic' | 'nonbasic' | 'fallback';

export interface LandCut {
  ac: AnalyzedCard;
  kind: LandCutKind;
  /** For basics: the count this cut takes you from. e.g. 8 (cutting brings to 7). */
  beforeCount?: number;
  afterCount?: number;
  /** Set on `fallback` rows so the UI can render a warning badge. */
  warning?: string;
}

export interface SelectLandCutsInput {
  landCards: AnalyzedCard[];          // analysis.landCards (all lands, basics + nonbasics)
  nonLandCards: ScryfallCard[];       // current non-land cards in deck (for basic-fetcher scan)
  colorFixing: ColorFixingAnalysis;   // for pipDemand
  colorIdentity: string[];            // ['W','U','B','R','G'] subset
  target: number;                     // effective land target (userLandTarget ?? mb.adjustedSuggestion)
  currentLands: number;               // analysis.manaBase.currentLands
  mustIncludeNames: Set<string>;
}

export interface SelectLandCutsResult {
  topN: LandCut[];                    // exactly min(N, available) entries; the cuts to make
  others: LandCut[];                  // additional candidates the user can substitute in
  basicFloor: number;                 // computed floor below which we won't cut basics
  basicFetcherCount: number;          // detected basic-fetcher count
}

export function selectLandCuts(_input: SelectLandCutsInput): SelectLandCutsResult {
  // Stub — implemented in subsequent tasks.
  return { topN: [], others: [], basicFloor: 0, basicFetcherCount: 0 };
}

const BASIC_NAMES = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
]);

const BASIC_TO_COLOR: Record<string, string> = {
  'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G',
  'Snow-Covered Plains': 'W', 'Snow-Covered Island': 'U', 'Snow-Covered Swamp': 'B',
  'Snow-Covered Mountain': 'R', 'Snow-Covered Forest': 'G',
  'Wastes': 'C',
};

interface BasicGroup {
  name: string;       // 'Forest', 'Snow-Covered Forest', 'Wastes', etc.
  color: string;      // 'W'|'U'|'B'|'R'|'G'|'C'
  count: number;
  /** A representative AnalyzedCard from this group (used for rendering). */
  sample: AnalyzedCard;
}

/** Group basics by name with counts, in stable name order. */
function groupBasics(landCards: AnalyzedCard[]): BasicGroup[] {
  const map = new Map<string, BasicGroup>();
  for (const ac of landCards) {
    if (!BASIC_NAMES.has(ac.card.name)) continue;
    const existing = map.get(ac.card.name);
    if (existing) {
      existing.count++;
    } else {
      map.set(ac.card.name, {
        name: ac.card.name,
        color: BASIC_TO_COLOR[ac.card.name] || 'C',
        count: 1,
        sample: ac,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Select up to `wantCuts` basic-cut LandCut entries, never dropping total basics
 * below `basicFloor`. Picks from most-oversupplied color first; ties broken by larger
 * group then alphabetical name.
 *
 * Oversupply per color = currentBasicsForColor - expectedBasicsForColor,
 * where expected is proportional to pip-demand share. If pipDemandTotal is 0 (no
 * colored spells), distribute expected evenly across colors present in basics.
 */
function selectBasicCuts(
  basics: BasicGroup[],
  totalBasics: number,
  basicFloor: number,
  pipDemand: Record<string, number>,
  pipDemandTotal: number,
  wantCuts: number,
): LandCut[] {
  const cuts: LandCut[] = [];
  if (wantCuts <= 0 || totalBasics <= basicFloor) return cuts;

  // Working copy of counts so we can decrement as we cut.
  const counts = new Map<string, number>();
  for (const g of basics) counts.set(g.name, g.count);

  const colorsPresent = [...new Set(basics.map(g => g.color))];

  const computeOversupply = (): { name: string; over: number; count: number }[] => {
    const totalNow = [...counts.values()].reduce((s, n) => s + n, 0);
    return basics
      .filter(g => (counts.get(g.name) ?? 0) > 0)
      .map(g => {
        const cur = counts.get(g.name) ?? 0;
        // Sum of all basics currently of this group's color.
        const colorTotal = basics
          .filter(other => other.color === g.color)
          .reduce((s, other) => s + (counts.get(other.name) ?? 0), 0);
        // Expected share: pip-demand for this color / pipDemandTotal × totalNow.
        // If pipDemandTotal is 0, evenly distribute among colorsPresent.
        const expectedColor = pipDemandTotal > 0
          ? (pipDemand[g.color] || 0) / pipDemandTotal * totalNow
          : totalNow / Math.max(1, colorsPresent.length);
        const over = colorTotal - expectedColor;
        return { name: g.name, over, count: cur };
      });
  };

  let totalNow = totalBasics;
  const remainingToCut = () => Math.min(wantCuts - cuts.length, totalNow - basicFloor);

  while (remainingToCut() > 0) {
    const ranked = computeOversupply()
      .sort((a, b) => {
        if (b.over !== a.over) return b.over - a.over;
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    if (ranked.length === 0) break;
    const pick = ranked[0];
    const group = basics.find(g => g.name === pick.name)!;
    const before = counts.get(pick.name) ?? 0;
    const after = before - 1;
    counts.set(pick.name, after);
    totalNow--;
    cuts.push({
      ac: group.sample,
      kind: 'basic',
      beforeCount: before,
      afterCount: after,
    });
  }

  return cuts;
}
