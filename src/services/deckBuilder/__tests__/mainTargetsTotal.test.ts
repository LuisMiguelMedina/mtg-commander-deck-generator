import { describe, it, expect } from 'vitest';
import {
  getCurvePhases,
  type CurveBreakdown,
  type CurveSlot,
  type MainTargetDeckBudget,
} from '../deckAnalyzer';

/**
 * PBI-13 acceptance (red until Dev).
 * When the tempo strip's main targets (early / mid / late) are the deck budget,
 * the UI total is 99: lands already added count, and each spell/land MDFC counts
 * once. Today `getCurvePhases` normalizes those targets to the live non-land
 * count (MDFCs included as spells) and ignores `deckBudget`.
 * docs/pbi/PBI-13-main-targets-total.md
 *
 * Screenshot shape from upstream #13: early 47, mid 26, late 10 (sum 83).
 */

const DECK_SIZE = 99;
const LANDS_ALREADY_ADDED = 37;
const MDFC_COUNT = 4;
/** Live non-land curve, MDFCs included on their front face. 47 + 26 + 10. */
const LIVE_NON_LAND = 83;

const BUDGET: MainTargetDeckBudget = {
  deckSize: DECK_SIZE,
  landsAlreadyAdded: LANDS_ALREADY_ADDED,
  mdfcCount: MDFC_COUNT,
};

function slot(cmc: number, count: number): CurveSlot {
  return { cmc, current: count, target: count, delta: 0 };
}

function breakdown(cmc: number): CurveBreakdown {
  return { cmc, current: 0, target: 0, delta: 0, cards: [] };
}

/** Phase targets the tempo strip shows for this pile. */
function mainTargetSum(): number {
  const slots: CurveSlot[] = [
    slot(1, 20),
    slot(2, 27), // early 47
    slot(3, 16),
    slot(4, 10), // mid 26
    slot(5, 6),
    slot(6, 4),  // late 10
  ];
  const breakdowns: CurveBreakdown[] = slots.map(s => breakdown(s.cmc));
  const phases = getCurvePhases(
    breakdowns,
    slots,
    LIVE_NON_LAND,
    'balanced',
    undefined,
    BUDGET,
  );
  return phases.reduce((sum, phase) => sum + phase.target, 0);
}

/** Lands count, and each MDFC (also inside the spell targets) counts once. */
function uiDeckTotal(spellTargets: number): number {
  return spellTargets + LANDS_ALREADY_ADDED - MDFC_COUNT;
}

describe('PBI-13 main targets total 99', () => {
  it('is 99 when main targets are met, counting lands and each MDFC once', () => {
    expect(uiDeckTotal(mainTargetSum())).toBe(DECK_SIZE);
  });

  it('includes lands already added in that 99', () => {
    // Spell budget must leave room for the lands, putting the MDFCs back once
    // because they are already inside the land count.
    const spellBudget = DECK_SIZE - LANDS_ALREADY_ADDED + MDFC_COUNT;
    expect(mainTargetSum()).toBe(spellBudget);
  });

  it('counts each MDFC once toward the 99', () => {
    const spells = mainTargetSum();
    const countedOnce = spells + LANDS_ALREADY_ADDED - MDFC_COUNT;
    const doubled = spells + LANDS_ALREADY_ADDED;
    const landsOmitted = spells;
    expect(countedOnce).toBe(DECK_SIZE);
    expect(doubled).not.toBe(DECK_SIZE);
    expect(landsOmitted).not.toBe(DECK_SIZE);
  });
});
