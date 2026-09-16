"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { Hint } from "@/shared/components/ui/tooltip";
import { OVERLAY_CIRCLE, OVERLAY_CLUSTER } from "@/modules/watching/components/shared/Marks";
import { useQuickAdd } from "@/modules/watching/hooks/useQuickAdd";
import type { MediaType, WatchingMedia } from "@/modules/watching/types";

/**
 * THE « + » ON A POSTER YOU DON'T OWN — one tap, into Want to Watch (owner, 2026-09-16, §12).
 *
 * Top-right, because the right cluster is where every ACTION in Watching lives (the menu, the
 * heart's old slot); the left is for what a title IS. It used to sit in the middle of the artwork
 * and do nothing but open the discover page — the whole tile does that already. Now it adds:
 * `useQuickAdd` fetches the bundle and the credits exactly like the discover buttons do, priority
 * medium, refined on the fiche. Then it turns into a teal ✓ that OPENS the fiche — the tile has
 * become yours, and everything under `WATCHING_KEYS` refetches so the bookmark shows up on it.
 *
 * Revealed on hover with a mouse, always there on touch — the menu's own rule. A `span` with a
 * button role, not a `<button>`: it sits inside tiles that are buttons themselves, and buttons
 * don't nest.
 */
export function AddMark({ tmdbId, type, title, className, onAdded }: {
  tmdbId: number;
  /** The kind the surface knows. A `serie` hint is re-read from TMDB (an anime is a series to most callers). */
  type: MediaType;
  title: string;
  className?: string;
  onAdded?: (media: WatchingMedia) => void;
}) {
  const router = useRouter();
  const { addByTmdb } = useQuickAdd();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "pending" } | { kind: "done"; id: string }>({ kind: "idle" });

  const act = async () => {
    if (state.kind === "pending") return;
    if (state.kind === "done") { router.push(`/perso/watching/${state.id}`); return; }
    setState({ kind: "pending" });
    try {
      const media = await addByTmdb(tmdbId, type);
      setState({ kind: "done", id: media.id });
      onAdded?.(media);
    } catch {
      setState({ kind: "idle" });
    }
  };

  const done = state.kind === "done";
  return (
    <div
      className={cn(
        OVERLAY_CLUSTER, "right-2",
        !done && "opacity-100 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Hint label={done ? "In your library" : "Want to watch"}>
        <span
          role="button"
          tabIndex={0}
          aria-label={done ? `${title} is in your library — open it` : `Add ${title} to Want to Watch`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void act(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); void act(); } }}
          className={cn(OVERLAY_CIRCLE, "cursor-pointer text-white/80 transition-colors hover:bg-black/85 hover:text-white", done && "text-accent-watching-vivid hover:text-accent-watching-vivid")}
        >
          {state.kind === "pending" ? <Loader2 size={13} className="animate-spin" /> : done ? <Check size={13} /> : <Plus size={13} />}
        </span>
      </Hint>
    </div>
  );
}
