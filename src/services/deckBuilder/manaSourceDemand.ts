/** Sources required for a color's pip-demand bar to read 100% (VoBo #14). */
export function computeManaSourceDemand(pips: number): number {
  return Math.ceil(0.8 * pips + 2);
}

/** Fill percent of the pip-demand bar. 100 means `sources >= demand`. */
export function manaSourceDemandBarPercent(sources: number, pips: number): number {
  const demand = computeManaSourceDemand(pips);
  if (demand <= 0) return 0;
  return Math.min(100, Math.round((sources / demand) * 100));
}
