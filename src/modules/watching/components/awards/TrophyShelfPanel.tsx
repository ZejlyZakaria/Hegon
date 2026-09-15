"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SearchInput } from "@/shared/components/ui/search-input";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { ScoreMark } from "@/modules/watching/components/shared/Marks";
import { displayTitle } from "@/modules/watching/utils";
import type { ShelfItem } from "@/modules/watching/lib/awards";
import type { AwardCeremony } from "@/modules/watching/types";

/**
 * THE WHOLE SHELF — the rail shows a window of it; this is all of it, most recent win first,
 * searchable. Same door as the watchlist's "See all": a sliding panel of MediaRows, each with its
 * best win and how many more, your rating on the right.
 */
export function TrophyShelfPanel({ open, onClose, shelf, ceremony }: { open: boolean; onClose: () => void; shelf: ShelfItem[]; ceremony: AwardCeremony }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? shelf.filter((s) => displayTitle(s.owned).toLowerCase().includes(needle)) : shelf;
  }, [shelf, q]);

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<Trophy size={15} style={{ color: "var(--color-award)" }} />}
      title={
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">Your trophy shelf</span>
          <span className="text-micro tabular-nums text-text-tertiary">{shelf.length} {ceremony === "emmys" ? "Emmy" : "Oscar"} {shelf.length === 1 ? "winner" : "winners"}</span>
        </div>
      }
    >
      <div className="px-4 pt-4">
        <SearchInput size="sm" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} placeholder="Search your shelf…" />
      </div>
      <ul className="px-2 py-3">
        {rows.map((s) => (
          <li key={s.owned.id}>
            <MediaRow
              href={`/perso/watching/${s.owned.id}`}
              posterUrl={s.owned.poster_url}
              title={displayTitle(s.owned)}
              meta={
                <span className="truncate text-micro text-text-tertiary" title={s.labels.join(" · ")}>
                  <span className="tabular-nums">{s.entry.year}</span> · {s.labels[0]}
                  {s.more > 0 && ` · +${s.more}`}
                </span>
              }
              right={s.owned.user_rating != null && s.owned.user_rating > 0 ? <ScoreMark value={s.owned.user_rating} source="mine" /> : undefined}
            />
          </li>
        ))}
        {rows.length === 0 && <li className="px-2 py-6 text-xs text-text-tertiary">No title matches.</li>}
      </ul>
    </SlidingPanel>
  );
}
