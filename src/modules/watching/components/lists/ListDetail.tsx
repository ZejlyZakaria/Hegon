"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { tmdbImageFor } from "../../lib/tmdb-image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bookmark, Check, Eye, EyeOff, FileText, Film, LayoutGrid, List,
  Loader2, MoreHorizontal, Play, Plus,
  Search, SlidersHorizontal, Star, Trash2, Trophy, X,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import { Button } from "@/shared/components/ui/button";
import { Hint } from "@/shared/components/ui/tooltip";
import { InlineFormActions } from "@/shared/components/ui/inline-form-actions";
import { Badge } from "@/shared/components/ui/badge";
import { GOLD, MINE, RankMark, OVERLAY_CLUSTER, OVERLAY_CIRCLE } from "@/modules/watching/components/shared/Marks";
import { WATCHING_ACCENT } from "../../ui";

// Type is a category → a tinted badge, one colour per type. It used to be a grey pill that
// said nothing beyond its word.
const TYPE_COLOR: Record<string, string> = {
  film: "#60a5fa",
  serie: "#a78bfa",
  anime: "#fb923c",
};
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { SearchInput } from "@/shared/components/ui/search-input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import {
  useListItems,
  useUpdateMediaList,
  useDeleteMediaList,
  useUpdateListItemNote,
  useRemoveItemFromList,
  useSearchMediaForList,
  useAddItemToList,
  useSearchTmdbForList,
  useAddTmdbItemToList,
} from "../../hooks/useMediaLists";
import { useWatchActions } from "../../hooks/useWatchActions";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { ListGlyph, LIST_ICON_KEYS } from "./list-glyph";
import type { MediaListWithThumbnails } from "../../service";
import type { MediaListItemWithMedia, TmdbListResult } from "../../types";
import { displayTitle } from "../../utils";

type SortKey = "position" | "title" | "year" | "rating";
type ViewMode = "table" | "grid";
type FilterKey = "all" | "watched" | "unwatched";

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; textClass: string }> = {
  completed:     { label: "Watched",       dotClass: "bg-emerald-400", textClass: "text-emerald-400"   },
  watching:      { label: "In Progress",   dotClass: "bg-accent-watching-vivid", textClass: "text-accent-watching-vivid" },
  plan_to_watch: { label: "Want to Watch", dotClass: "bg-zinc-500",    textClass: "text-zinc-400"      },
  dropped:       { label: "Dropped",       dotClass: "bg-red-500",     textClass: "text-red-400"       },
  reference:     { label: "Unwatched",     dotClass: "bg-zinc-600",    textClass: "text-zinc-500"      },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortItems(items: MediaListItemWithMedia[], sort: SortKey): MediaListItemWithMedia[] {
  return [...items].sort((a, b) => {
    switch (sort) {
      case "title":  return a.media.title.localeCompare(b.media.title);
      case "year":   return (b.media.year ?? 0) - (a.media.year ?? 0);
      case "rating": return (b.media.user_rating ?? 0) - (a.media.user_rating ?? 0);
      default:       return a.position - b.position;
    }
  });
}

function formatUpdated(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Updated today";
  if (diff === 1) return "Updated yesterday";
  if (diff < 7)  return `Updated ${diff}d ago`;
  if (diff < 30) return `Updated ${Math.floor(diff / 7)}w ago`;
  return `Updated ${Math.floor(diff / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() !== now.getFullYear()
      ? { month: "short", day: "numeric", year: "2-digit" }
      : { month: "short", day: "numeric" };
  return d.toLocaleDateString("en-US", opts);
}

function mediaTypeLabel(type: string): string {
  return type === "film" ? "Movie" : type === "serie" ? "TV Show" : "Anime";
}

// ── Poster Hero ───────────────────────────────────────────────────────────────

function Poster({ src, title }: { src: string | null; title?: string }) {
  return (
    <>
      <div className="absolute inset-0 bg-zinc-800" />
      {src && <Image src={tmdbImageFor(src, 320) || src} alt="" fill className="object-cover transition-opacity duration-200" sizes="320px" loading="lazy" />}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/80 to-transparent" />
      {title && (
        <p className="absolute bottom-2 left-2 right-2 truncate text-micro font-semibold leading-tight text-white">
          {title}
        </p>
      )}
    </>
  );
}

// Rendered inside a `relative w-80 self-stretch` container — fills parent height
function PosterHero({ thumbnails, emoji }: { thumbnails: { backdrop_url: string | null; title: string }[]; emoji: string | null }) {
  const count = Math.min(thumbnails.length, 4);

  if (count === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-4xl opacity-20">
        <ListGlyph value={emoji} size={40} fallback />
      </div>
    );
  }

  if (count === 1) {
    return <div className="absolute inset-0"><Poster src={thumbnails[0].backdrop_url} title={thumbnails[0].title} /></div>;
  }

  if (count === 2) {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-y-0 left-0 right-1/2"><Poster src={thumbnails[0].backdrop_url} title={thumbnails[0].title} /></div>
        <div className="absolute inset-y-0 bg-black/40" style={{ left: "50%", width: 1 }} />
        <div className="absolute inset-y-0 left-1/2 right-0"><Poster src={thumbnails[1].backdrop_url} title={thumbnails[1].title} /></div>
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-y-0 left-0" style={{ right: "40%" }}><Poster src={thumbnails[0].backdrop_url} title={thumbnails[0].title} /></div>
        <div className="absolute inset-y-0 bg-black/40" style={{ right: "40%", width: 1 }} />
        <div className="absolute top-0 right-0 bottom-1/2" style={{ left: "60%" }}><Poster src={thumbnails[1].backdrop_url} title={thumbnails[1].title} /></div>
        <div className="absolute right-0 bg-black/40" style={{ left: "60%", top: "50%", height: 1 }} />
        <div className="absolute top-1/2 right-0 bottom-0" style={{ left: "60%" }}><Poster src={thumbnails[2].backdrop_url} title={thumbnails[2].title} /></div>
      </div>
    );
  }

  // 4 — 2×2 grid
  return (
    <div className="absolute inset-0">
      <div className="absolute top-0 left-0 right-1/2 bottom-1/2"><Poster src={thumbnails[0].backdrop_url} title={thumbnails[0].title} /></div>
      <div className="absolute inset-y-0 bg-black/40" style={{ left: "50%", width: 1 }} />
      <div className="absolute top-0 left-1/2 right-0 bottom-1/2"><Poster src={thumbnails[1].backdrop_url} title={thumbnails[1].title} /></div>
      <div className="absolute inset-x-0 bg-black/40" style={{ top: "50%", height: 1 }} />
      <div className="absolute top-1/2 left-0 right-1/2 bottom-0"><Poster src={thumbnails[2].backdrop_url} title={thumbnails[2].title} /></div>
      <div className="absolute top-1/2 left-1/2 right-0 bottom-0"><Poster src={thumbnails[3].backdrop_url} title={thumbnails[3].title} /></div>
    </div>
  );
}

// ── Add Title Popover ─────────────────────────────────────────────────────────

function AddTitlePopover({ listId, userId, existingIds, existingTmdbIds }: {
  listId: string;
  userId: string;
  existingIds: string[];
  existingTmdbIds: Set<number>;
}) {
  const [query, setQuery] = useState("");
  const [addingTmdbId, setAddingTmdbId] = useState<number | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  const { data: libraryResults = [], isFetching: libFetching } = useSearchMediaForList(userId, debouncedQuery);
  const { data: tmdbResults = [],   isFetching: tmdbFetching } = useSearchTmdbForList(debouncedQuery);
  const addItem     = useAddItemToList(listId, userId);
  const addTmdbItem = useAddTmdbItemToList(listId, userId);

  // Exclude TMDB items already in the library results OR already in this list
  const libraryTmdbIds  = new Set(libraryResults.map((m) => m.tmdb_id).filter((id) => id > 0));
  const tmdbOnlyResults = tmdbResults.filter((r) => !libraryTmdbIds.has(r.id) && !existingTmdbIds.has(r.id));

  const hasLibrary = libraryResults.length > 0;
  const hasTmdb    = tmdbOnlyResults.length > 0;
  const isFetching = libFetching || tmdbFetching;

  const handleAdd = async (mediaItemId: string) => {
    try {
      await addItem.mutateAsync(mediaItemId);
      toast("Added to list.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed — already in list?");
    }
  };

  const handleAddFromTmdb = async (item: TmdbListResult) => {
    setAddingTmdbId(item.id);
    try {
      await addTmdbItem.mutateAsync(item);
      toast("Added to list.");
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to add.");
    } finally {
      setAddingTmdbId(null);
    }
  };

  return (
    <Popover.Root onOpenChange={(open) => { if (!open) { setQuery(""); setAddingTmdbId(null); } }}>
      <Popover.Trigger asChild>
        <Button variant="accent" size="sm" style={WATCHING_ACCENT} className="shrink-0">
          <Plus />
          <span className="hidden sm:inline">Add title</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 overflow-hidden rounded-card border border-border-strong bg-surface-3 shadow-md">
          {/* Search input */}
          <div className="border-b border-border-subtle p-2">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search library or TMDB…"
                className="w-full rounded-control bg-surface-2 py-2 pl-8 pr-8 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              {isFetching && debouncedQuery.length >= 2 && (
                <Loader2 size={11} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-1">
            {debouncedQuery.length < 2 && (
              <p className="py-8 text-center text-xs text-text-tertiary">Type to search your library or TMDB</p>
            )}
            {debouncedQuery.length >= 2 && !isFetching && !hasLibrary && !hasTmdb && (
              <p className="py-8 text-center text-xs text-text-tertiary">No results found</p>
            )}

            {/* ── Library section ── */}
            {hasLibrary && (
              <>
                <p className="px-2 pb-1 pt-2 text-caption uppercase text-text-tertiary/50">
                  Your Library
                </p>
                {libraryResults.map((media) => {
                  const inList = existingIds.includes(media.id);
                  return (
                    <button
                      key={media.id}
                      type="button"
                      onClick={() => !inList && handleAdd(media.id)}
                      disabled={inList || addItem.isPending}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors",
                        inList ? "cursor-default opacity-40" : "hover:bg-surface-2",
                      )}
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-chip">
                        {media.poster_url
                          ? <Image src={tmdbImageFor(media.poster_url, 40) || media.poster_url} alt="" fill loading="lazy" className="object-cover" sizes="40px" />
                          : <div className="h-full w-full bg-zinc-800" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">{displayTitle(media)}</p>
                        <p className="text-xs text-text-tertiary">{media.year} · {mediaTypeLabel(media.type)}</p>
                      </div>
                      {inList && <Check size={13} className="shrink-0 text-accent-watching" />}
                    </button>
                  );
                })}
              </>
            )}

            {/* Separator */}
            {hasLibrary && hasTmdb && (
              <div className="mx-2 my-1.5 h-px bg-border-subtle" />
            )}

            {/* ── TMDB section ── */}
            {hasTmdb && (
              <>
                <p className="px-2 pb-1 pt-2 text-caption uppercase text-text-tertiary/50">
                  From TMDB
                </p>
                {tmdbOnlyResults.map((item) => {
                  const year = (item.release_date ?? item.first_air_date ?? "").slice(0, 4);
                  const typeLabel =
                    item.media_type === "movie" ? "Movie"
                    : item.genre_ids.includes(16) && item.origin_country.includes("JP") ? "Anime"
                    : "TV Show";
                  const isThisAdding = addingTmdbId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addingTmdbId === null && handleAddFromTmdb(item)}
                      disabled={addingTmdbId !== null}
                      className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-chip">
                        {item.poster_path
                          ? <Image src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="" fill loading="lazy" className="object-cover" sizes="40px" />
                          : <div className="h-full w-full bg-zinc-800" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">{displayTitle(item)}</p>
                        <p className="text-xs text-text-tertiary">{year} · {typeLabel}</p>
                      </div>
                      {isThisAdding
                        ? <Loader2 size={11} className="shrink-0 animate-spin text-text-tertiary" />
                        : <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400">TMDB</span>
                      }
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── More Menu ─────────────────────────────────────────────────────────────────

function MoreMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="quiet"
        size="icon-sm"
        onClick={() => setOpen((p) => !p)}
        aria-label="List actions"
        className={cn(open && "bg-surface-3 text-text-primary")}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-card border border-border-strong bg-surface-3 py-1 shadow-md">
          <button
            type="button"
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
          >
            <Trash2 size={13} />
            Delete list
          </button>
        </div>
      )}
    </div>
  );
}

// ── Status Dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({ item }: { item: MediaListItemWithMedia }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // The third copy of "mark as watched" — same rules as the detail page and the poster menus now,
  // because there is only one copy left. It too was writing `watched: true` with no position on
  // shows that are still airing.
  const actions = useWatchActions(item.media);

  const status = STATUS_CONFIG[item.media.watch_status ?? "plan_to_watch"] ?? STATUS_CONFIG.plan_to_watch;
  const isSeries = item.media.type === "serie" || item.media.type === "anime";
  const currentStatus = item.media.watch_status;
  const isCompleted = currentStatus === "completed";

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const handleAction = (action: "watched" | "in_progress" | "want_to_watch") => {
    setOpen(false);
    if (action === "in_progress") return void actions.startWatching();
    if (action === "want_to_watch") return void actions.wantToWatch();
    // A running series cannot be "watched". It can be CAUGHT UP — and that is what the row says.
    void (actions.canComplete ? actions.markWatched() : actions.markCaughtUp());
  };

  const pill = (
    <div className="flex items-center gap-1.5">
      {actions.isPending
        ? <Loader2 size={9} className="animate-spin text-text-tertiary" />
        : <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
      }
      <span className={cn("text-micro leading-none", status.textClass)}>{status.label}</span>
    </div>
  );

  if (isCompleted) {
    return <div className="px-1.5 py-1">{pill}</div>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        disabled={actions.isPending}
        className={cn(
          "rounded px-1.5 py-1 transition-colors hover:bg-surface-2",
          open && "bg-surface-2",
        )}
      >
        {pill}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-40 overflow-hidden rounded-card border border-border-strong bg-surface-3 py-1 shadow-md">
          {/* No completion affordance on an unreleased film — there is nothing to mark. */}
          {actions.canMark && (
            <button
              type="button"
              onClick={() => handleAction("watched")}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-label text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <Check size={11} className="shrink-0 text-emerald-400" />
              {actions.canComplete ? "Mark as watched" : "Seen everything that's out"}
            </button>
          )}
          {isSeries && currentStatus !== "watching" && (
            <button
              type="button"
              onClick={() => handleAction("in_progress")}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-label text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <Play size={11} className="shrink-0 fill-current" style={{ color: "var(--color-accent-watching-vivid)" }} />
              Start watching
            </button>
          )}
          {currentStatus !== "plan_to_watch" && (
            <button
              type="button"
              onClick={() => handleAction("want_to_watch")}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-label text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <Bookmark size={11} className="shrink-0 text-zinc-400" />
              Want to Watch
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────

function TableRow({
  item, idx, isRanked, listId, onOpen, onRemove,
}: {
  item: MediaListItemWithMedia;
  idx: number;
  isRanked: boolean;
  listId: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const updateNote = useUpdateListItemNote(listId);
  const [noteVal, setNoteVal] = useState(item.note ?? "");

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-3 border-b border-border-subtle/40 bg-surface-1 px-4 py-2 transition-colors hover:bg-surface-2">
        {/* Rank */}
        <div className="w-8 shrink-0 text-right">
          <span className={cn("text-sm tabular-nums", isRanked ? "font-bold text-amber-400" : "text-text-tertiary/40")}>
            {idx + 1}
          </span>
        </div>

        {/* Poster — the xs rung: `rounded-thumb` + a hairline ring like every other xs poster
            (this is a table row, not a MediaRow, so only the frame is shared). */}
        <div className="relative aspect-2/3 w-(--poster-xs) shrink-0 cursor-pointer overflow-hidden rounded-thumb ring-1 ring-border-subtle" onClick={onOpen}>
          {item.media.poster_url
            ? <Image src={tmdbImageFor(item.media.poster_url, 28) || item.media.poster_url} alt="" fill loading="lazy" className="object-cover" sizes="28px" />
            : <div className="h-full w-full bg-zinc-800" />
          }
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <p className="truncate text-sm font-medium leading-tight text-text-primary">{displayTitle(item.media)}</p>
          {item.note && !noteOpen && (
            <p className="mt-0.5 truncate text-micro italic text-text-tertiary">&quot;{item.note}&quot;</p>
          )}
        </div>

        {/* Year */}
        <div className="hidden w-12 shrink-0 text-sm tabular-nums text-text-tertiary sm:block">
          {item.media.year}
        </div>

        {/* Type */}
        <div className="hidden w-20 shrink-0 md:block">
          <Badge color={TYPE_COLOR[item.media.type] ?? "var(--color-text-tertiary)"}>
            {mediaTypeLabel(item.media.type)}
          </Badge>
        </div>

        {/* TMDB's score → GOLD. Yours → TEAL. They both used to be an amber star (one just
            paler), so the two numbers were indistinguishable at a glance. */}
        <div className="hidden w-16 shrink-0 lg:block">
          {item.media.rating > 0 ? (
            <span className="flex items-center gap-1 text-xs tabular-nums text-text-secondary">
              <Star size={10} style={{ color: GOLD, fill: GOLD }} />
              {item.media.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary/30">—</span>
          )}
        </div>

        <div className="w-20 shrink-0">
          {item.media.user_rating != null ? (
            <span className="flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: MINE }}>
              <Star size={10} style={{ color: MINE, fill: MINE }} />
              {item.media.user_rating}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary/30">—</span>
          )}
        </div>

        {/* Status */}
        <div className="hidden w-28 shrink-0 sm:block">
          <StatusDropdown item={item} />
        </div>

        {/* Date added */}
        <div className="hidden w-20 shrink-0 text-xs tabular-nums text-text-tertiary/60 md:block">
          {formatDate(item.added_at)}
        </div>

        {/* Actions — always visible on touch, hover-reveal on desktop */}
        <div className="flex w-14 shrink-0 items-center justify-end gap-0.5 opacity-100 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100">
          <Hint label={item.note ? "Edit note" : "Add a note"}>
            <Button
              variant="subtle"
              size="icon-sm"
              aria-label="Note"
              onClick={(e) => { e.stopPropagation(); setNoteOpen((p) => !p); }}
              className={cn(item.note && "text-accent-watching-vivid")}
            >
              <FileText />
            </Button>
          </Hint>
          <Hint label="Remove from list">
            <Button
              variant="subtle"
              size="icon-sm"
              aria-label="Remove from list"
              onClick={onRemove}
              className="hover:text-red-400"
            >
              <X />
            </Button>
          </Hint>
        </div>
      </div>

      {/* Inline note */}
      {noteOpen && (
        <div className="mx-4 mb-2 border-b border-border-subtle/40 pb-2 pt-1.5">
          <textarea
            autoFocus
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="Add a note about this title…"
            rows={2}
            className="w-full resize-none rounded-control border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
          <div className="mt-1.5 flex justify-end">
            <InlineFormActions
              accent="var(--color-accent-watching)"
              saving={updateNote.isPending}
              onCancel={() => { setNoteOpen(false); setNoteVal(item.note ?? ""); }}
              onSave={async () => {
                try {
                  await updateNote.mutateAsync({ listItemId: item.list_item_id, note: noteVal.trim() || null });
                  setNoteOpen(false);
                } catch (err) {
                  if (isDemoReadOnlyError(err)) return;
                  toast.error("Failed to save note.");
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grid Item ─────────────────────────────────────────────────────────────────

function GridItem({ item, rank, onOpen, onRemove, listId }: {
  item: MediaListItemWithMedia;
  rank: number | null;
  onOpen: () => void;
  onRemove: () => void;
  listId: string;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const updateNote = useUpdateListItemNote(listId);
  const [noteVal, setNoteVal] = useState(item.note ?? "");

  const handleSaveNote = async () => {
    try {
      await updateNote.mutateAsync({ listItemId: item.list_item_id, note: noteVal.trim() || null });
      setNoteOpen(false);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to save note.");
    }
  };

  return (
    <div className="group relative">
      <div className="relative cursor-pointer" onClick={onOpen}>
        <div className="relative aspect-2/3 overflow-hidden rounded-tile transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
          {item.media.poster_url ? (
            <Image src={tmdbImageFor(item.media.poster_url, 200) || item.media.poster_url} alt={item.media.title} fill loading="lazy" className="object-cover" sizes="(max-width: 768px) 33vw, 200px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800">
              <span className="text-2xl opacity-20">🎬</span>
            </div>
          )}
          {/* THE OVERLAY GRAMMAR, at last — left cluster = IDENTITY. This was a frosted pill at
              `left-1.5 top-1.5`, i.e. both the wrong material (nothing moves behind a poster) and
              a third private guess at where a mark sits. `RankMark` is what a rank looks like
              everywhere else in the module — the Top 10 rail and the hero — so a list's rank now
              reads as the same thing, and `OVERLAY_CLUSTER` aligns it with the actions opposite by
              construction instead of by two matching numbers that have to be kept in step. */}
          {rank !== null && (
            <div className={cn(OVERLAY_CLUSTER, "left-2.5")}>
              <RankMark rank={rank} />
            </div>
          )}
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{displayTitle(item.media)}</p>
        <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown item={item} />
        </div>
      </div>

      {/* …and the right cluster = ACTIONS, on the same inset and the same 24px rung as the rank. */}
      <div className={cn(OVERLAY_CLUSTER, "right-2.5 opacity-100 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100")}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setNoteOpen(!noteOpen); }}
          className={cn(
            OVERLAY_CIRCLE, "transition-colors hover:bg-black/85",
            item.note ? "text-accent-watching" : "text-white/60 hover:text-white",
          )}
        >
          <FileText size={10} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className={cn(OVERLAY_CIRCLE, "text-white/60 transition-colors hover:bg-black/85 hover:text-white")}
        >
          <X size={10} />
        </button>
      </div>

      {noteOpen && (
        <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="Note…"
            rows={2}
            className="w-full resize-none rounded-control border border-border-subtle bg-surface-2 px-2.5 py-2 text-micro text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={updateNote.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-chip bg-accent-watching py-1 text-micro font-semibold text-white disabled:opacity-50"
            >
              {updateNote.isPending ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="rounded-chip px-2 py-1 text-micro text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List Detail ───────────────────────────────────────────────────────────────

export function ListDetail({ list, userId, onBack }: { list: MediaListWithThumbnails; userId: string; onBack: () => void }) {
  const router = useRouter();
  const { data: rawItems = [], isLoading } = useListItems(list.id);
  const removeItem = useRemoveItemFromList(list.id);
  const updateList = useUpdateMediaList(userId);
  const deleteList = useDeleteMediaList(userId);

  const [view, setView]               = useState<ViewMode>("table");
  const [sort, setSort]               = useState<SortKey>("position");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch]           = useState("");

  const [editName, setEditName]     = useState(list.name);
  const [editEmoji, setEditEmoji]   = useState(list.emoji ?? "");
  const [editDesc, setEditDesc]     = useState(list.description ?? "");
  const [editRanked, setEditRanked] = useState(list.is_ranked);

  const watchedCount  = rawItems.filter((i) => i.media.watch_status === "completed").length;
  const ratedItems    = rawItems.filter((i) => i.media.user_rating != null);
  const avgRating     = ratedItems.length > 0
    ? ratedItems.reduce((sum, i) => sum + (i.media.user_rating ?? 0), 0) / ratedItems.length
    : null;

  const heroThumbnails = !isLoading && rawItems.length > 0
    ? rawItems.slice(0, 4).map((i) => ({ backdrop_url: i.media.backdrop_url, title: i.media.title }))
    : [];

  const unwatchedCount = rawItems.length - watchedCount;

  const FILTER_TABS = [
    { key: "all"       as FilterKey, label: "All",       count: rawItems.length },
    { key: "watched"   as FilterKey, label: "Watched",   count: watchedCount    },
    { key: "unwatched" as FilterKey, label: "Unwatched", count: unwatchedCount  },
  ];

  const filteredByTab =
    activeFilter === "all"       ? rawItems
    : activeFilter === "watched" ? rawItems.filter((i) => i.media.watch_status === "completed")
    :                              rawItems.filter((i) => i.media.watch_status !== "completed");

  const filteredItems = search.trim()
    ? filteredByTab.filter((i) => i.media.title.toLowerCase().includes(search.toLowerCase()))
    : filteredByTab;

  const items       = sortItems(filteredItems, sort);
  const existingIds     = rawItems.map((i) => i.media.id);
  const existingTmdbIds = new Set(rawItems.filter((i) => (i.media.tmdb_id ?? 0) > 0).map((i) => i.media.tmdb_id));

  const handleAutoSave = async (overrides?: { name?: string; emoji?: string; desc?: string; ranked?: boolean }) => {
    const name    = (overrides?.name    ?? editName).trim()  || list.name;
    const emoji   = (overrides?.emoji   ?? editEmoji)        || null;
    const desc    = (overrides?.desc    ?? editDesc).trim()  || null;
    const ranked  =  overrides?.ranked  ?? editRanked;
    if (
      name   === list.name &&
      emoji  === (list.emoji        ?? null) &&
      desc   === (list.description  ?? null) &&
      ranked === list.is_ranked
    ) return;
    try {
      await updateList.mutateAsync({ id: list.id, data: { name, emoji, description: desc, is_ranked: ranked } });
    } catch (err) {
      if (isDemoReadOnlyError(err)) {
        // Read-only demo: undo the optimistic local edits so nothing appears to change.
        setEditName(list.name);
        setEditEmoji(list.emoji ?? "");
        setEditDesc(list.description ?? "");
        setEditRanked(list.is_ranked);
        return;
      }
      toast.error("Failed to update list.");
    }
  };

  const handleToggleRanked = async () => {
    const next = !editRanked;
    setEditRanked(next);
    try {
      await updateList.mutateAsync({
        id: list.id,
        data: { name: editName.trim() || list.name, emoji: editEmoji || null, description: editDesc.trim() || null, is_ranked: next },
      });
    } catch (err) {
      setEditRanked(!next);
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to update list.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteList.mutateAsync(list.id);
      toast("List deleted.");
      onBack();
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to delete list.");
    }
  };

  const handleRemove = async (mediaItemId: string) => {
    try {
      await removeItem.mutateAsync({ mediaItemId });
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to remove.");
    }
  };

  return (
    <div className="flex flex-col">

      {/* ── Contextual topbar ── */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-zinc-950 px-4 sm:px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back to Lists</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="hidden flex-1 sm:block" />

        {/* 32px, like the two buttons beside it. The offset was mechanical: SearchInput had
            no size at all and sat at 36px next to 32px controls. */}
        <SearchInput
          size="sm"
          containerClassName="min-w-0 flex-1 sm:w-52 sm:flex-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search in this list…"
        />

        <AddTitlePopover listId={list.id} userId={userId} existingIds={existingIds} existingTmdbIds={existingTmdbIds} />
        <MoreMenu onDelete={handleDelete} />
      </div>

      {/* ── Hero ── */}
      <div className="mx-4 sm:mx-6 my-4 overflow-hidden rounded-modal bg-surface-1 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6 lg:min-h-47.5">

          {/* Backdrop collage — full width on mobile, fills card height on desktop */}
          <div className="relative w-full shrink-0 aspect-video overflow-hidden rounded-card ring-1 ring-white/20 lg:aspect-auto lg:w-80 lg:self-stretch">
            <PosterHero thumbnails={heroThumbnails} emoji={list.emoji} />
          </div>

          {/* Info — inline editable */}
          <div className="min-w-0 flex-1 py-1 flex flex-col gap-1">

            {/* Emoji + Title + Ranked */}
            <div className="flex items-center gap-2">
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" className="shrink-0 leading-none transition-opacity hover:opacity-70">
                    {editEmoji ? <ListGlyph value={editEmoji} size={18} /> : <span className="text-text-tertiary/30 text-base">＋</span>}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="start"
                    sideOffset={8}
                    className="z-50 flex flex-wrap gap-1 p-2 w-56 rounded-card border border-border-strong bg-surface-3 shadow-md"
                  >
                    {LIST_ICON_KEYS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setEditEmoji(e);
                          handleAutoSave({ emoji: e });
                        }}
                        className={cn(
                          "rounded-chip px-2 py-2 transition-colors hover:bg-surface-2",
                          editEmoji === e && "bg-accent-watching/20",
                        )}
                      >
                        <ListGlyph value={e} size={18} />
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleAutoSave()}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="flex-1 min-w-0 text-xl font-bold leading-tight text-text-primary bg-transparent focus:outline-none"
              />

              {/* "Ranked" is a MODE, not an action — and a mode you can't see is a mode you
                  don't trust. It was a ghost icon at 30% opacity that only named itself once
                  already on. Now it's a real two-state control that always says what it does. */}
              <Hint label={editRanked ? "Numbered list — click to unrank" : "Number this list, best first"}>
                <Button
                  variant={editRanked ? "accent" : "quiet"}
                  size="sm"
                  style={editRanked ? WATCHING_ACCENT : undefined}
                  onClick={handleToggleRanked}
                  className="shrink-0"
                >
                  <Trophy />
                  {editRanked ? "Ranked" : "Rank"}
                </Button>
              </Hint>
            </div>

            {/* Description */}
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => handleAutoSave()}
              placeholder="Add description…"
              rows={2}
              className="resize-none bg-transparent text-sm leading-relaxed text-text-secondary placeholder:text-text-tertiary/30 focus:outline-none"
            />

            <div className="flex-1" />

            {/* Updated date — bottom */}
            <p className="text-xs text-text-tertiary/50">{formatUpdated(list.updated_at)}</p>
          </div>

          {/* Stats panel — 2×2 on mobile, 4 rows on desktop */}
          <div className="shrink-0 w-full overflow-hidden rounded-card bg-surface-2 grid grid-cols-2 lg:flex lg:w-64 lg:flex-col lg:justify-around py-2">
            {[
              { value: rawItems.length,                                                        label: "Titles",      icon: <Film   size={14} className="text-white" /> },
              { value: watchedCount,                                                           label: "Watched",     icon: <Eye    size={14} className="text-white" /> },
              { value: rawItems.length - watchedCount,                                         label: "Unwatched",   icon: <EyeOff size={14} className="text-white" /> },
              { value: avgRating !== null ? parseFloat(avgRating.toFixed(1)).toString() : "—", label: "Avg. rating", icon: <Star   size={14} className="text-white" /> },
            ].map(({ value, label, icon }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-2.5">
                {icon}
                <span className="text-sm font-bold text-text-primary">{value}</span>
                <span className="text-xs text-text-tertiary">{label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Filter tabs + toolbar ── */}
      <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {/* All / Watched / Unwatched is a VIEW SWITCH on the same data — that's the segmented
            control's exact job. Hand-rolled underline tabs read as page navigation, which
            these are not. */}
        <SegmentedControl<FilterKey>
          size="sm"
          value={activeFilter}
          onChange={setActiveFilter}
          items={FILTER_TABS.filter((t) => t.key === "all" || t.count > 0).map((tab) => ({
            value: tab.key,
            label: tab.key === "all" ? tab.label : `${tab.label} ${tab.count}`,
          }))}
        />

        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={11} className="text-text-tertiary" />
            <FilterSelect
              size="sm"
              className="w-32"
              value={sort}
              onChange={setSort}
              options={[
                { value: "position", label: "Order" },
                { value: "title", label: "Title" },
                { value: "year", label: "Year" },
                { value: "rating", label: "My rating" },
              ] as const}
              aria-label="Sort list"
            />
          </div>

          {/* A view switcher IS a segmented control — it was just wearing a costume. */}
          <SegmentedControl<"table" | "grid">
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { value: "table", label: "", icon: <List size={13} /> },
              { value: "grid", label: "", icon: <LayoutGrid size={13} /> },
            ]}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col pb-8">
        {isLoading && (
          <div className="space-y-px px-4 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-control bg-surface-1" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          rawItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-3xl leading-none">
                {list.emoji ?? <Film size={26} className="text-text-tertiary" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">This list is empty</p>
                <p className="text-xs text-text-tertiary">Use “Add title” above to add from your library or TMDB</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                <Search size={18} className="text-text-tertiary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">No results</p>
                <p className="text-xs text-text-tertiary">Try a different filter or search term</p>
              </div>
            </div>
          )
        )}

        {!isLoading && items.length > 0 && view === "table" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border-subtle/50 px-4 py-2 text-caption uppercase text-text-tertiary/50">
              <div className="w-8 shrink-0 text-right">#</div>
              <div className="w-9 shrink-0" />
              <div className="min-w-0 flex-1">Title</div>
              <div className="hidden w-12 shrink-0 sm:block">Year</div>
              <div className="hidden w-20 shrink-0 md:block">Type</div>
              <div className="hidden w-16 shrink-0 lg:block">TMDB</div>
              <div className="w-20 shrink-0">My rating</div>
              <div className="hidden w-28 shrink-0 sm:block">Status</div>
              <div className="hidden w-20 shrink-0 md:block">Added</div>
              <div className="w-14 shrink-0" />
            </div>
            {items.map((item, idx) => (
              <TableRow
                key={item.list_item_id}
                item={item}
                idx={idx}
                isRanked={list.is_ranked}
                listId={list.id}
                onOpen={() => router.push(`/perso/watching/${item.media.id}`)}
                onRemove={() => handleRemove(item.media.id)}
              />
            ))}
          </div>
        )}

        {!isLoading && items.length > 0 && view === "grid" && (
          <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 sm:p-6 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {items.map((item, idx) => (
              <GridItem
                key={item.list_item_id}
                item={item}
                rank={list.is_ranked ? idx + 1 : null}
                listId={list.id}
                onOpen={() => router.push(`/perso/watching/${item.media.id}`)}
                onRemove={() => handleRemove(item.media.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

