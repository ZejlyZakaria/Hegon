/** Legacy count safety check; counts cannot prove growth. */
export function providerRegressed(previous: number[] | null, next: number[]): boolean {
  return previous != null && previous.some((count, i) => count > (next[i] ?? 0));
}
/** The database classifier is the authority, not a worker's count/date heuristic. */
export function providerRefreshSucceeded(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const observation = result as { classification?: string; growth?: boolean };
  return ["BASELINE", "GROWTH", "RESTORATION", "CORRECTION", "UNCHANGED"].includes(observation.classification ?? "")
    && typeof observation.growth === "boolean";
}
