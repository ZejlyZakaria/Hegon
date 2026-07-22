"use client";

import Image from "next/image";
import { Trophy } from "lucide-react";
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

/**
 * RANKING, ON THE PAGE THAT OWNS THE TITLE.
 *
 * Until now the only way to rank something was the ADD modal — you re-added a title you already
 * owned, because the modal was the only surface with a rank picker. `AddMediaModal` even carries a
 * comment saying so, and calls itself an exception waiting to be retired. This is that retirement.
 *
 * The picker shows WHO HOLDS EACH PLACE, not just which numbers are free (that is all the modal
 * could tell you, so a full Top 10 was simply unrankable). Picking an occupied place SWAPS the two
 * titles. A cascade — "everything below shifts down" — reads as the more natural ranking gesture,
 * and it is: it also silently drops whatever was tenth off the list. A swap moves exactly the two
 * titles you can see, and taking the same action twice puts them back.
 */
export function TopTenRank({ media }: { media: WatchingMedia }) {
  const { data: ranked = [] } = useMediaItems({
    userId: media.user_id,
    type: media.type,
    topRated: true,
  });
  const updateMedia = useUpdateMedia();

  const current = media.priority ?? null;
  const holderOf = (slot: number) => ranked.find((r) => r.priority === slot && r.id !== media.id);

  const write = async (id: string, priority: number | null) =>
    updateMedia.mutateAsync({
      id,
      // Naming the type scopes the cache invalidation to the rail that actually moved.
      type: media.type,
      priority,
      // A rank IS a claim of affection — the Top 10 rail reads `favorite: true` alongside the
      // number, so unranking has to let go of both or the title lingers in a rail it left.
      favorite: priority !== null,
    });

  const pick = async (slot: number) => {
    if (updateMedia.isPending) return;
    const holder = holderOf(slot);
    try {
      if (slot === current) {
        await write(media.id, null);
        toast.success("Removed from your Top 10.");
        return;
      }
      // The swap is two writes, and the OTHER title moves first: if the second write fails, the
      // worst case is a title left unranked — never two titles claiming the same place.
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
      title={
        <span className="flex items-center gap-1.5">
          {/* Teal, not the amber the add modal uses: colour names the SOURCE in this module, gold
              is the world's and teal is yours — and a Top 10 is entirely yours. Same teal as the
              rank on the rail's cards and in the hero. */}
          <Trophy size={12} style={{ color: MINE }} />
          Top 10
        </span>
      }
      subtitle={current ? `This is your #${current}` : "Not ranked yet"}
    >
      <div className="flex gap-1.5">
        {SLOTS.map((slot) => {
          const holder = holderOf(slot);
          const isMine = slot === current;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => pick(slot)}
              disabled={updateMedia.isPending}
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
    </Panel>
  );
}
