/** Display rounding never establishes completion. */
export function watchingTargetReached(count: number, target: number | null): boolean {
  return target != null && target > 0 && count >= target;
}
