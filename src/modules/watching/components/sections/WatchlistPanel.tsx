"use client";

import { useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SearchInput } from "@/shared/components/ui/search-input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { MediaRow } from "@/modules/watching/components/shared/MediaRow";
import { PriorityMark } from "@/modules/watching/components/shared/Marks";
import { useMediaItems } from "@/modules/watching/hooks/useMediaItems";
import type { MediaType, WatchingMedia } from "@/modules/watching/types";

/**
 * THE WHOLE WATCHLIST — what the rail is a window on.
 *
 * Its own query, uncapped (the rail's 20 and the page's old 50 both hid titles; a list you cannot
 * see is a list you forget), and the two things a long list needs: a way to order it and a way to
 * narrow it. Nothing here writes — a row opens the fiche, where every action lives.
 */

type Sort = "added" | "priority" | "title" | "year";
type Level = "all" | "high" | "medium" | "low";

const SORTS: { value: Sort; label: string }[] = [
  { value: "added", label: "Recently added" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
];
const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortBy(items: WatchingMedia[], sort: Sort): WatchingMedia[] {
  const out = [...items];
  switch (sort) {
    case "priority":
      // High first; unprioritised last; ties keep the query's recency.
      return out.sort((a, b) => (RANK[a.priority_level ?? ""] ?? 3) - (RANK[b.priority_level ?? ""] ?? 3));
    case "title":
      return out.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    default:
      return out; // the query's own order: most recently added first
  }
}

export function WatchlistPanel({
  open, onClose, userId, type,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  type: MediaType;
}) {
  const [sort, setSort] = useState<Sort>("added");
  const [level, setLevel] = useState<Level>("all");
  const [q, setQ] = useState("");

  // Fetched only while the panel is open — the rail never pays for the list it doesn't show.
  const { data: items = [], isLoading } = useMediaItems({ userId, type, wantToWatch: true, released: true, enabled: open });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const kept = items.filter((it) =>
      (level === "all" || it.priority_level === level)
      && (!needle || it.title.toLowerCase().includes(needle) || (it.original_title ?? "").toLowerCase().includes(needle)),
    );
    return sortBy(kept, sort);
  }, [items, level, q, sort]);

  const noun = type === "film" ? "films" : type === "serie" ? "shows" : "animes";

  return (
    <SlidingPanel
      open={open}
      onClose={onClose}
      icon={<Bookmark size={15} className="text-accent-watching-vivid" />}
      title={
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-text-primary">
          <span className="shrink-0">Want to Watch</span>
          {!isLoading && <span className="font-normal tabular-nums text-text-tertiary">{items.length} {noun}</span>}
        </h2>
      }
    >
      <div className="px-4 py-4">
        {/* Narrow, then order. The search takes the row; the two controls share the next one. */}
        <SearchInput
          size="sm"
          containerClassName="w-full"
          placeholder={`Search your ${noun}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
        />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <SegmentedControl<Level>
            size="sm"
            value={level}
            onChange={setLevel}
            items={[
              { value: "all", label: "All" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <FilterSelect size="sm" className="w-36" value={sort} onChange={setSort} options={SORTS} aria-label="Sort" />
        </div>

        <div className="mt-4">
          {isLoading ? (
            <ul className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className="aspect-2/3 w-(--poster-xs) animate-pulse rounded-thumb bg-surface-2" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-surface-2" />
                    <div className="h-2 w-1/3 animate-pulse rounded-full bg-surface-2" />
                  </div>
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-tertiary">
              {items.length === 0 ? "Nothing on your watchlist yet." : "Nothing matches."}
            </p>
          ) : (
            <ul>
              {rows.map((it) => (
                <li key={it.id}>
                  <MediaRow
                    href={`/perso/watching/${it.id}`}
                    posterUrl={it.poster_url}
                    title={it.title}
                    meta={
                      <span className="truncate text-micro text-text-tertiary">
                        {[it.year, it.tags?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                      </span>
                    }
                    right={it.priority_level ? <PriorityMark level={it.priority_level} size="row" className="mr-1.5" /> : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SlidingPanel>
  );
}
