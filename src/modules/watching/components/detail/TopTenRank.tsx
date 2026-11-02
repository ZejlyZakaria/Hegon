"use client";

import Image from "next/image";
import { ListOrdered } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Panel } from "@/shared/components/ui/panel";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useMediaItems } from "@/modules/watching/hooks/useMediaItems";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import { tmdbImageFor } from "@/modules/watching/lib/tmdb-image";
import { MINE } from "@/modules/watching/components/shared/Marks";
import type { WatchingMedia } from "@/modules/watching/types";

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Personal rank is independent of favorite. The editor opens only when requested. */
export function TopTenRank({ media }: { media: WatchingMedia }) {
  const { data: ranked = [] } = useMediaItems({
    userId: media.user_id,
    type: media.type,
    topRated: true,
  });
  const updateMedia = useUpdateMedia();

  const [editing,setEditing] = useState(false);
  const current = media.priority ?? null;
  const holderOf = (slot: number) => ranked.find((r) => r.priority === slot && r.id !== media.id);

  const write = async (id: string, priority: number | null) =>
    updateMedia.mutateAsync({
      id,
      expected_revision: id === media.id ? media.personal_revision : ranked.find(row => row.id === id)?.personal_revision,
      // Naming the type scopes the cache invalidation to the rail that actually moved.
      type: media.type,
      priority,
    });

  const pick = async (slot: number | null) => {
    if (updateMedia.isPending) return;
    const holder = slot == null ? null : holderOf(slot);
    try {
      if (slot === null) {
        await write(media.id, null);
        toast.success("Removed from your Top 10.");
        return;
      }
      // Existing revision-guarded swap: update the holder, then this title. A failed
      // second request is reported; no success is announced for a partial result.
      if (holder) await write(holder.id, current);
      await write(media.id, slot);
      toast.success(holder ? `Swapped with ${holder.title}.` : `Ranked #${slot} in your Top 10.`);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Could not change the ranking.");
    }
  };

  return (
    <Panel
      title="Top 10"
      actions={<Button variant="quiet" size="sm" onClick={()=>setEditing(v=>!v)} aria-expanded={editing}>{editing ? "Done" : current ? "Change" : "Rank title"}</Button>}
    >
      <p className="text-sm text-text-secondary">{current ? <>Your rank <span className="ml-1 font-semibold tabular-nums text-accent-watching-vivid">#{current}</span></> : <span className="flex items-center gap-3"><ListOrdered size={18} className="shrink-0 text-text-tertiary"/><span className="text-xs leading-relaxed text-text-secondary">Keep your standout titles here.</span></span>}</p>
      {editing && <>
      <p className="mb-3 mt-3 text-xs leading-relaxed text-text-tertiary">Choose a place. An occupied place swaps the two titles.</p>
      <div className="grid grid-cols-5 gap-2">
        {SLOTS.map((slot) => {
          const holder = slot == null ? null : holderOf(slot);
          const isMine = slot === current;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => pick(slot)}
              disabled={updateMedia.isPending || isMine}
              aria-label={
                isMine
                  ? `Remove from your Top 10 (currently #${slot})`
                  : holder
                    ? `Take place ${slot}, swapping with ${holder.title}`
                    : `Rank this #${slot}`
              }
              className={cn(
                "group relative aspect-2/3 flex-1 overflow-hidden rounded-chip ring-1 transition-all",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isMine ? "ring-2" : "ring-border-subtle hover:ring-border-default",
              )}
              style={isMine ? { "--tw-ring-color": MINE } as React.CSSProperties : undefined}
            >
              {/* The occupant's own artwork, dimmed — you are choosing between titles, so the
                  choice should show titles rather than ten identical numbered boxes. */}
              {holder?.poster_url && (
                <Image
                  src={tmdbImageFor(holder.poster_url, 60) || holder.poster_url}
                  alt=""
                  aria-hidden
                  fill
                  sizes="40px"
                  className="object-cover opacity-40 transition-opacity group-hover:opacity-70"
                />
              )}
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-micro font-bold tabular-nums",
                  !isMine && (holder ? "text-white" : "text-text-tertiary"),
                )}
                style={{
                  ...(isMine ? { color: MINE } : null),
                  ...(holder ? { textShadow: "0 1px 3px rgba(0,0,0,0.9)" } : null),
                }}
              >
                {slot}
              </span>
            </button>
          );
        })}
      </div>
      {current != null && <Button variant="quiet" size="sm" className="mt-3" disabled={updateMedia.isPending} onClick={()=>pick(null)}>Remove from Top 10</Button>}
      </>}
    </Panel>
  );
}
