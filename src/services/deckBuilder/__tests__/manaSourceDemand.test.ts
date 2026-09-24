import { describe, it, expect } from 'vitest';
import {
  computeManaSourceDemand,
  manaSourceDemandBarPercent,
} from '../manaSourceDemand';

/**
 * PBI-14 acceptance (red until Dev).
 * VoBo: demand = Math.ceil(0.8 * pips + 2)
 *   pips 5 → 6, pips 4 → 6, pips 30 → 26
 * Today `computeManaSourceDemand` is the lands-tab bar: 100% at 2 sources per pip
 * (`sources / pips * 50`). Not `Math.floor(pips / 2) + 1` (superseded errata).
 * docs/pbi/PBI-14-mana-pips-demand.md
 */
const FORMULA = (pips: number) => Math.ceil(0.8 * pips + 2);

describe('PBI-14 mana source demand', () => {
  it('pips 5 demands 6 sources', () => {
    expect(computeManaSourceDemand(5)).toBe(6);
    expect(computeManaSourceDemand(5)).toBe(FORMULA(5));
  });

  it('pips 4 demands 6 sources', () => {
    expect(computeManaSourceDemand(4)).toBe(6);
    expect(computeManaSourceDemand(4)).toBe(FORMULA(4));
  });

  it('pips 30 demands 26 sources', () => {
    expect(computeManaSourceDemand(30)).toBe(26);
    expect(computeManaSourceDemand(30)).toBe(FORMULA(30));
  });

  it('fills the bar to 100% at that demand, not at 2 sources per pip', () => {
    for (const pips of [5, 4, 30]) {
      const demand = FORMULA(pips);
      expect(manaSourceDemandBarPercent(demand, pips)).toBe(100);
      expect(manaSourceDemandBarPercent(demand - 1, pips)).toBeLessThan(100);
    }
  });

  it('does not use floor(pips/2)+1 or the raw pip count as demand', () => {
    // 5 pips: floor formula is 3, raw pips is 5, scaled demand is 6.
    expect(computeManaSourceDemand(5)).toBe(FORMULA(5));
    expect(computeManaSourceDemand(5)).not.toBe(Math.floor(5 / 2) + 1);
    expect(computeManaSourceDemand(5)).not.toBe(5);
    // 30 pips: floor formula is 16, raw pips is 30, scaled demand is 26.
    expect(computeManaSourceDemand(30)).toBe(FORMULA(30));
    expect(computeManaSourceDemand(30)).not.toBe(Math.floor(30 / 2) + 1);
    expect(computeManaSourceDemand(30)).not.toBe(30);
  });
});
