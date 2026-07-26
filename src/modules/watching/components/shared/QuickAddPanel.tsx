"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Loader2 } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { SearchInput } from "@/shared/components/ui/search-input";
import { MediaRow } from "./MediaRow";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useSearchTmdbForList } from "../../hooks/useMediaLists";
import { useOwnedMediaIds } from "../../hooks/useOwnedTmdbIds";
import { useQuickAdd } from "../../hooks/useQuickAdd";
import { ownedRowFor } from "../../lib/possession";
import { tmdbResultType } from "../../service";
import { cn } from "@/shared/utils/utils";
import type { ListType, MediaType, TmdbListResult } from "../../types";

const TEAL = "var(--color-accent-watching-vivid)";
const TYPE_LABEL = { film: "Movie", serie: "TV", anime: "Anime" } as const;
const SCOPE_LABEL: Record<MediaType, string> = { film: "movies", serie: "series", anime: "animes" };

// The three quick destinations. Each is an INTENT — the status is derived from it, never asked.
// (Top 10 is not here: adding with a rank belongs on the fiche, not in a quick pass.)
const DESTS: { key: ListType; label: string }[] = [
  { key: "wantToWatch", label: "Want to watch" },
  { key: "inProgress", label: "Watching" },
  { key: "recentlyWatched", label: "Watched" },
];

// The library's bookmark colours — high/medium/low, red/amber/grey — same convention as the fiche.
type Priority = "high" | "medium" | "low";
const PRIORITY: { key: Priority; dot: string; text: string; on: string }[] = [
  { key: "high",   dot: "bg-red-400",   text: "text-red-400",   on: "bg-red-400/10 border-red-400/30" },
  { key: "medium", dot: "bg-amber-400", text: "text-amber-400", on: "bg-amber-400/10 border-amber-400/30" },
  { key: "low",    dot: "bg-zinc-500",  text: "text-zinc-400",  on: "bg-zinc-500/10 border-zinc-500/30" },
];

// Recent searches — the ONE thing an add panel's empty space can show that nothing else in the app
// does. Not trending, not recommendations (those live on the main page); just the queries you ran,
// to re-find a title in one tap. localStorage, most-recent-first, capped.
const RECENT_KEY = "watching:recent-searches";
function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(q: string): string[] {
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

function yearOf(r: TmdbListResult): string | null {
  const d = r.release_date || r.first_air_date;
  return d ? String(new Date(d).getFullYear()) : null;
}

/**
 * QUICK ADD — search-first, pick-to-add, stays open. The section you opened it from sets the
 * destination chip (its intent); you can retarget, and the choice holds for the next adds so a
 * burst all lands in one place. Want to watch carries a priority (its only meaningful attribute).
 * No other form: rating, exact position and Top 10 rank are refined on the fiche. An owned title is
 * never re-added — it offers to open instead.
 */
export function QuickAddPanel({
  open,
  onClose,
  defaultList = "wantToWatch",
  mediaType,
}: {
  open: boolean;
  onClose: () => void;
  defaultList?: ListType;
  /** Scope the search to one type — a typed page (Movies/TV/Animes) adds only that. Omit = all. */
  mediaType?: MediaType;
}) {
  const router = useRouter();
  const userId = useCurrentUserId();
  const [dest, setDest] = useState<ListType>(defaultList);
  const [priority, setPriority] = useState<Priority>("medium");
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 200);
  const { data: allResults = [], isFetching } = useSearchTmdbForList(debounced);
  // On a typed page the add is scoped to that type — an anime page adds animes, nothing else. Same
  // classifier the whole app uses, so search agrees with where a title would land.
  const results = useMemo(
    () => (mediaType ? allResults.filter((r) => tmdbResultType(r) === mediaType) : allResults),
    [allResults, mediaType],
  );
  const tmdbIds = useMemo(() => results.map((r) => r.id), [results]);
  const { data: owned = {} } = useOwnedMediaIds(userId ?? "", tmdbIds);
  const { add } = useQuickAdd();
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [recent, setRecent] = useState<string[]>([]);

  // The section that opened the panel sets the starting destination; a fresh open re-syncs it, reads
  // your recent searches, and clears the last burst.
  useEffect(() => {
    if (open) { setDest(defaultList); setRecent(readRecent()); }
    else { setQuery(""); setAddedIds(new Set()); setAddingId(null); }
  }, [open, defaultList]);

  const onPick = async (r: TmdbListResult) => {
    const q = query.trim();
    if (q.length >= 2) setRecent(pushRecent(q));
    const mine = ownedRowFor(r, owned);
    if (mine) { onClose(); router.push(`/perso/watching/${mine.id}`); return; }
    if (addingId || addedIds.has(r.id)) return;
    setAddingId(r.id);
    try {
      await add(r, dest, dest === "wantToWatch" ? priority : undefined);
      setAddedIds((s) => new Set(s).add(r.id));
    } catch {
      /* useAddMedia surfaces the toast */
    } finally {
      setAddingId(null);
    }
  };

  const destLabel = DESTS.find((d) => d.key === dest)?.label;
  const typing = query.trim().length >= 2;

  return (
    <SlidingPanel open={open} onClose={onClose} title="Add to your library">
      {/* Search LEADS — the hero. Destination + (want-to-watch) priority sit UNDER it as quiet
          context, not competing chrome: the section you came from already set them. Sticky. */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-1 px-4 pb-3 pt-3.5">
        <SearchInput
          size="sm"
          autoFocus
          placeholder={mediaType ? `Search ${SCOPE_LABEL[mediaType]}…` : "Search titles…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />

        {/* Destination — quiet text tabs, the active one lit teal. Not buttons; a whisper. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {DESTS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDest(d.key)}
              className={cn(
                "font-medium transition-colors",
                d.key === dest ? "text-accent-watching-vivid" : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Priority — want-to-watch's only meaningful attribute; a quiet inline row, gone elsewhere. */}
        {dest === "wantToWatch" && (
          <div className="mt-2.5 flex items-center gap-1">
            <span className="mr-1 text-micro uppercase tracking-wide text-text-tertiary">Priority</span>
            {PRIORITY.map((p) => {
              const on = p.key === priority;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key)}
                  className={cn(
                    "flex items-center gap-1 rounded-control border border-transparent px-1.5 py-0.5 text-micro font-medium transition-colors",
                    on ? `${p.on} ${p.text}` : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", on ? p.dot : "bg-border-strong")} />
                  {p.key.charAt(0).toUpperCase() + p.key.slice(1)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Body — results while typing, recent searches at rest. */}
      {typing ? (
        <div className="px-2 py-1.5">
          {isFetching && results.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 size={15} className="animate-spin text-text-tertiary" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-text-tertiary">
              {mediaType ? `No ${SCOPE_LABEL[mediaType]} found` : "Nothing found"} for “{query}”.
            </p>
          ) : (
            <ul>
              {results.map((r) => {
                const type = tmdbResultType(r);
                const year = yearOf(r);
                const mine = ownedRowFor(r, owned);
                const isAdding = addingId === r.id;
                const isAdded = addedIds.has(r.id);
                return (
                  <li key={`${r.media_type}-${r.id}`}>
                    <MediaRow
                      onClick={() => onPick(r)}
                      disabled={isAdding}
                      posterUrl={r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null}
                      title={r.title}
                      meta={
                        <span className="truncate text-micro text-text-tertiary">
                          {TYPE_LABEL[type]}{year ? ` · ${year}` : ""}
                        </span>
                      }
                      right={
                        isAdding ? (
                          <Loader2 size={13} className="animate-spin text-text-tertiary" />
                        ) : isAdded ? (
                          <span className="flex items-center gap-1 text-micro font-medium" style={{ color: TEAL }}>
                            <Check size={11} /> Added
                          </span>
                        ) : mine ? (
                          <span className="flex items-center gap-1 text-micro font-medium" style={{ color: TEAL }}>
                            <Check size={11} /> In library
                          </span>
                        ) : (
                          <Plus size={14} className="text-text-tertiary" />
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : recent.length > 0 ? (
        <div className="px-4 pt-4">
          <p className="mb-2 text-caption uppercase tracking-wide text-text-tertiary">Recent searches</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="rounded-control bg-surface-2 px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-5 text-micro leading-relaxed text-text-tertiary">
            What you pick lands in <span className="font-medium text-text-secondary">{destLabel}</span>.
          </p>
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-xs leading-relaxed text-text-tertiary">
          Type to search — what you pick lands in{" "}
          <span className="font-medium text-text-secondary">{destLabel}</span>.
        </p>
      )}
    </SlidingPanel>
  );
}
