/** Failures remain visible without aborting successful items. No-op alone is success. */
export function batchOutcome(succeeded: number, failed: number) {
  const outcome = failed === 0 ? "success" : succeeded > 0 ? "partial" : "failure";
  return { outcome, ok: outcome === "success", status: outcome === "failure" ? 500 : outcome === "partial" ? 207 : 200 };
}
