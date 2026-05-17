// Tracks task ids currently in-flight from an optimistic mutation.
// Used by useRealtimeTasks to skip the self-echo invalidation that
// would otherwise snap-back the optimistic update mid-drag.

const inFlight = new Set<string>();

export function markOptimistic(taskId: string) {
  inFlight.add(taskId);
}

export function clearOptimistic(taskId: string) {
  inFlight.delete(taskId);
}

export function isOptimistic(taskId: string | undefined | null): boolean {
  if (!taskId) return false;
  return inFlight.has(taskId);
}
