import { toast } from "@/shared/utils/toast";

// Read-only demo guard for Watching mutations. The DB blocks demo writes via
// RESTRICTIVE RLS; this is the matching client-side layer so a demo visitor
// gets a friendly notice instead of a failed-write error.

/** Thrown by a mutation when the read-only demo account attempts a write. */
export class DemoReadOnlyError extends Error {
  constructor() {
    super("read-only demo");
    this.name = "DemoReadOnlyError";
  }
}

export function isDemoReadOnlyError(e: unknown): boolean {
  return e instanceof Error && e.name === "DemoReadOnlyError";
}

/** If `e` is a demo block, show the friendly notice and return true so the
 *  caller's onError can early-return before its generic error toast. */
export function handledDemoError(e: unknown): boolean {
  if (!isDemoReadOnlyError(e)) return false;
  toast("👀 This is a read-only demo — changes aren't saved.");
  return true;
}
