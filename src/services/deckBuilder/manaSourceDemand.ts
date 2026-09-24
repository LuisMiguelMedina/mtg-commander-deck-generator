/**
 * Sources required for a color's pip-demand bar to read 100%.
 *
 * Current behavior (upstream #14): the bar is `(sources / pips) * 50`, so it
 * fills at 2 sources per pip. That is the raw-pip bar. It is not
 * `Math.ceil(0.8 * pips + 2)` and not `Math.floor(pips / 2) + 1`.
 * Thin export of that math so the lands tab and the acceptance tests share
 * one function. The formula itself is unchanged.
 */
export function computeManaSourceDemand(pips: number): number {
  return 2 * Math.max(pips, 1);
}

/** Fill percent of the pip-demand bar. 100 means `sources >= demand`. */
export function manaSourceDemandBarPercent(sources: number, pips: number): number {
  const demand = computeManaSourceDemand(pips);
  if (demand <= 0) return 0;
  return Math.min(100, Math.round((sources / demand) * 100));
}
