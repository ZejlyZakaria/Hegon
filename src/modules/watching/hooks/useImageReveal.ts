import { useCallback, useRef, useState } from "react";

/**
 * ONLY FADE IN WHAT ACTUALLY LOADS.
 *
 * Every poster card fades its artwork in on `onLoad` — right for a picture arriving over the
 * network, wrong for one the browser already holds: coming Back to a page replayed a 200 ms fade
 * on forty cached posters at once, a page that "loads" although nothing was fetched.
 *
 * `onLoad` fires for a cached image too, so the event alone cannot tell the two apart. Two tells
 * can: the element is already `complete` when the ref attaches (the ideal case), or `onLoad` lands
 * within a few frames of the mount — a real transfer never does. Either way the picture is shown
 * at full opacity with NO transition; a picture that took its time still fades.
 *
 * One hook for the four card surfaces (rails, library, For You, Don't Miss), so the rule cannot
 * drift between them.
 */
const INSTANT_MS = 100;

export function useImageReveal() {
  const [state, setState] = useState<"pending" | "instant" | "faded">("pending");
  // Stamped when the element ATTACHES (the ref), not during render — render must stay pure.
  const attachedAt = useRef(0);

  const onLoad = useCallback(() => {
    const instant = performance.now() - attachedAt.current < INSTANT_MS;
    setState((s) => (s !== "pending" ? s : instant ? "instant" : "faded"));
  }, []);
  const attach = useCallback((el: HTMLImageElement | null) => {
    if (!el) return;
    attachedAt.current = performance.now();
    if (el.complete && el.naturalWidth > 0) setState((s) => (s === "pending" ? "instant" : s));
  }, []);

  return {
    /** Paint at full opacity. */
    loaded: state !== "pending",
    /** Skip the transition — the browser had it already. */
    instant: state === "instant",
    onLoad,
    /** Give it to the <img>'s `ref` — named `attach` so the lint does not read it as a ref value. */
    attach,
  };
}
