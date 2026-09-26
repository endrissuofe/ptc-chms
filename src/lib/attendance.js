/** The four door-count groups, in the order ushers count them. */
export const COUNT_FIELDS = ['men', 'women', 'teens', 'children'];

/** Upper limit for one group in one service; guards against typos like 1500 → 15000. */
export const MAX_COUNT = 20000;

/** Whole number between 0 and MAX_COUNT from whatever was typed or tapped. */
export function clampCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_COUNT);
}

export function totalCount(counts) {
  return COUNT_FIELDS.reduce((sum, f) => sum + (counts[f] || 0), 0);
}

/** A swing this big (in %) from last time is more likely a typo than a real change. */
export const UNUSUAL_CHANGE = 50;

export function isUnusualChange(change) {
  return change !== null && Math.abs(change) >= UNUSUAL_CHANGE;
}

/** Whole-number percent change, or null when there is nothing to compare with. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
