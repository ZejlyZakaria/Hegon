/** Counts going backwards are not evidence that the user's viewing went backwards. */
export function providerRegressed(previous: number[] | null, next: number[]): boolean {
  return previous != null && previous.some((count, i) => count > (next[i] ?? 0));
}
/** Restoring an old, already-dated episode on a settled season is not new content. */
export function confirmedGrowth(previous: number[] | null, next: number[], previousEnds: (string | null)[] | null, nextLatest: (string | null)[]): boolean {
  if (previous == null || providerRegressed(previous, next)) return false;
  return next.some((count, i) => count > (previous[i] ?? 0) && (!previousEnds?.[i] || (nextLatest[i] != null && nextLatest[i]! > previousEnds[i]!)));
}
