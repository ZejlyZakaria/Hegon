/** A legacy projection is not accepted evidence. Failed bootstraps retain a retry cooldown. */
export function needsProviderBootstrap(head: { accepted_snapshot_id: string | null; checked_at: string | null } | undefined, now: number, retryMs: number): boolean {
  if (head?.accepted_snapshot_id) return false;
  if (!head?.checked_at) return true;
  const checked = Date.parse(head.checked_at);
  return !Number.isFinite(checked) || now - checked >= retryMs;
}
