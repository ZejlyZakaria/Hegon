"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Eye, EyeOff, FileText, Film, LayoutGrid, List,
  Loader2, MoreHorizontal, Pencil, Plus,
  Search, SlidersHorizontal, Star, Trash2, Trophy, X,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { cn } from "@/shared/utils/utils";
import { toast } from "@/shared/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  useListItems,
  useUpdateMediaList,
  useDeleteMediaList,
  useUpdateListItemNote,
  useRemoveItemFromList,
  useSearchMediaForList,
  useAddItemToList,
} from "../../hooks/useMediaLists";
import type { MediaListWithThumbnails } from "../../service";
import type { MediaListItemWithMedia } from "../../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJIS = ["🎬", "📺", "🎭", "🏆", "❤️", "⭐", "🌟", "🎯", "🔥", "💎", "🌙", "🎵", "👑", "🎪", "📽️", "🧠"];

type SortKey = "position" | "title" | "year" | "rating";
type ViewMode = "table" | "grid";
type FilterKey = "all" | "watched" | "unwatched";

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; textClass: string }> = {
  completed:     { label: "Watched",        dotClass: "bg-emerald-400", textClass: "text-emerald-400"   },
  watching:      { label: "Watching",       dotClass: "bg-blue-400",    textClass: "text-blue-400"      },
  plan_to_watch: { label: "Plan to Watch",  dotClass: "bg-zinc-500",    textClass: "text-text-tertiary" },
  dropped:       { label: "Dropped",        dotClass: "bg-red-500",     textClass: "text-red-400"       },
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
      {src && <Image src={src} alt="" fill className="object-cover transition-opacity duration-500" sizes="320px" loading="eager" />}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-black/80 to-transparent" />
      {title && (
        <p className="absolute bottom-2 left-2 right-2 truncate text-[10px] font-semibold leading-tight text-white">
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
        {emoji ?? "📋"}
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

function AddTitlePopover({ listId, userId, existingIds }: { listId: string; userId: string; existingIds: string[] }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const { data: results = [], isFetching } = useSearchMediaForList(userId, debouncedQuery);
  const addItem = useAddItemToList(listId, userId);

  const handleAdd = async (mediaItemId: string) => {
    try {
      await addItem.mutateAsync(mediaItemId);
      toast("Added to list.");
    } catch {
      toast.error("Failed — already in list?");
    }
  };

  return (
    <Popover.Root onOpenChange={(open) => { if (!open) setQuery(""); }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-watching px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Add title
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 overflow-hidden rounded-xl border border-border-strong bg-surface-3 shadow-2xl">
          <div className="border-b border-border-subtle p-2">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your library…"
                className="w-full rounded-lg bg-surface-2 py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {debouncedQuery.length < 2 && (
              <p className="py-8 text-center text-xs text-text-tertiary">Type to search your library</p>
            )}
            {debouncedQuery.length >= 2 && isFetching && (
              <div className="flex justify-center py-8">
                <Loader2 size={16} className="animate-spin text-text-tertiary" />
              </div>
            )}
            {debouncedQuery.length >= 2 && !isFetching && results.length === 0 && (
              <p className="py-8 text-center text-xs text-text-tertiary">No results found</p>
            )}
            {results.map((media) => {
              const inList = existingIds.includes(media.id);
              return (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => !inList && handleAdd(media.id)}
                  disabled={inList || addItem.isPending}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                    inList ? "cursor-default opacity-50" : "hover:bg-surface-2",
                  )}
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md">
                    {media.poster_url
                      ? <Image src={media.poster_url} alt="" fill className="object-cover" sizes="40px" />
                      : <div className="h-full w-full bg-zinc-800" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{media.title}</p>
                    <p className="text-xs text-text-tertiary">{media.year} · {mediaTypeLabel(media.type)}</p>
                  </div>
                  {inList && <Check size={13} className="shrink-0 text-accent-watching" />}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── More Menu ─────────────────────────────────────────────────────────────────

function MoreMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-1 text-text-tertiary transition-colors hover:text-text-primary",
          open && "bg-surface-2 text-text-primary",
        )}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-border-strong bg-surface-3 py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => { onEdit(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <Pencil size={13} className="text-text-tertiary" />
            Edit list
          </button>
          <div className="my-1 h-px bg-border-subtle" />
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
  const status = STATUS_CONFIG[item.media.watch_status ?? "plan_to_watch"] ?? STATUS_CONFIG.plan_to_watch;

  return (
    <div className="flex flex-col">
      <div className="group flex items-center gap-3 border-b border-border-subtle/40 bg-surface-1 p-1.5 transition-colors hover:bg-surface-2">
        {/* Rank */}
        <div className="w-8 shrink-0 text-right">
          <span className={cn("text-sm tabular-nums", isRanked ? "font-bold text-amber-400" : "text-text-tertiary/40")}>
            {idx + 1}
          </span>
        </div>

        {/* Poster */}
        <div className="relative h-14 w-9 shrink-0 cursor-pointer overflow-hidden rounded-sm" onClick={onOpen}>
          {item.media.poster_url
            ? <Image src={item.media.poster_url} alt="" fill className="object-cover" sizes="28px" />
            : <div className="h-full w-full bg-zinc-800" />
          }
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
          <p className="truncate text-sm font-medium leading-tight text-text-primary">{item.media.title}</p>
          {item.note && !noteOpen && (
            <p className="mt-0.5 truncate text-[11px] italic text-text-tertiary">&quot;{item.note}&quot;</p>
          )}
        </div>

        {/* Year */}
        <div className="hidden w-12 shrink-0 text-sm tabular-nums text-text-tertiary sm:block">
          {item.media.year}
        </div>

        {/* Type */}
        <div className="hidden w-20 shrink-0 md:block">
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-text-tertiary">
            {mediaTypeLabel(item.media.type)}
          </span>
        </div>

        {/* TMDB rating */}
        <div className="hidden w-16 shrink-0 lg:block">
          {item.media.rating > 0 ? (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Star size={10} className="text-amber-400/50" />
              {item.media.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary/30">—</span>
          )}
        </div>

        {/* My rating */}
        <div className="w-20 shrink-0">
          {item.media.user_rating != null ? (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Star size={10} className="fill-current" />
              {item.media.user_rating}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary/30">—</span>
          )}
        </div>

        {/* Status */}
        <div className="hidden w-28 shrink-0 items-center gap-1.5 sm:flex">
          <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dotClass)} />
          <span className={cn("truncate text-xs", status.textClass)}>{status.label}</span>
        </div>

        {/* Date added */}
        <div className="hidden w-20 shrink-0 text-xs tabular-nums text-text-tertiary/60 md:block">
          {formatDate(item.added_at)}
        </div>

        {/* Actions */}
        <div className="flex w-14 shrink-0 items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setNoteOpen((p) => !p); }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-surface-2",
              item.note ? "text-accent-watching" : "text-text-tertiary",
            )}
          >
            <FileText size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-400"
          >
            <X size={13} />
          </button>
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
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await updateNote.mutateAsync({ listItemId: item.list_item_id, note: noteVal.trim() || null });
                setNoteOpen(false);
              }}
              disabled={updateNote.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-accent-watching px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {updateNote.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={10} />}
              Save
            </button>
            <button
              type="button"
              onClick={() => { setNoteOpen(false); setNoteVal(item.note ?? ""); }}
              className="rounded-lg px-2 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
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
    await updateNote.mutateAsync({ listItemId: item.list_item_id, note: noteVal.trim() || null });
    setNoteOpen(false);
  };

  return (
    <div className="group relative">
      <div className="relative cursor-pointer" onClick={onOpen}>
        <div className="relative aspect-2/3 overflow-hidden rounded-lg">
          {item.media.poster_url ? (
            <Image src={item.media.poster_url} alt={item.media.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="15vw" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800">
              <span className="text-2xl opacity-20">🎬</span>
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {rank !== null && (
            <div className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1.5 text-[10px] font-bold tabular-nums text-white backdrop-blur-sm">
              {rank}
            </div>
          )}
        </div>
        <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-secondary">{item.media.title}</p>
      </div>

      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setNoteOpen(!noteOpen); }}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm transition-colors hover:bg-black/90",
            item.note ? "text-accent-watching" : "text-white/60 hover:text-white",
          )}
        >
          <FileText size={10} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/60 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-white"
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
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-2 text-[11px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={updateNote.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent-watching py-1 text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {updateNote.isPending ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="rounded-md px-2 py-1 text-[10px] text-text-tertiary hover:text-text-primary"
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
  const [isEditing, setIsEditing]     = useState(false);

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
  const existingIds = rawItems.map((i) => i.media.id);

  const handleSaveEdit = async () => {
    try {
      await updateList.mutateAsync({
        id: list.id,
        data: {
          name:        editName.trim() || list.name,
          emoji:       editEmoji || null,
          description: editDesc.trim() || null,
          is_ranked:   editRanked,
        },
      });
      setIsEditing(false);
      toast("List updated.");
    } catch {
      toast.error("Failed to update list.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteList.mutateAsync(list.id);
      toast("List deleted.");
      onBack();
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  const handleRemove = async (mediaItemId: string) => {
    try {
      await removeItem.mutateAsync({ mediaItemId });
    } catch {
      toast.error("Failed to remove.");
    }
  };

  return (
    <div className="flex flex-col">

      {/* ── Contextual topbar ── */}
      <div className="flex items-center gap-3 border-b border-border-subtle bg-zinc-950 px-6 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to Lists
        </button>

        <div className="flex-1" />

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in this list…"
            className="w-52 rounded-lg border border-border-subtle bg-surface-1 py-1.5 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
        </div>

        <AddTitlePopover listId={list.id} userId={userId} existingIds={existingIds} />
        <MoreMenu onEdit={() => setIsEditing((p) => !p)} onDelete={handleDelete} />
      </div>

      {/* ── Hero ── */}
      <div className="mx-6 my-4 overflow-hidden rounded-2xl bg-surface-1 p-4">
        <div className="flex items-stretch gap-5 min-h-[190px]">

          {/* Backdrop collage — fills full card height */}
          <div className="relative w-80 shrink-0 self-stretch overflow-hidden rounded-xl ring-1 ring-white/20">
            <PosterHero thumbnails={heroThumbnails} emoji={list.emoji} />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 py-1">
            <h1 className="text-xl font-bold leading-tight text-text-primary">
              {list.emoji && <span className="mr-2">{list.emoji}</span>}
              {list.name}
            </h1>
            {list.description && (
              <p className="mt-2 text-sm leading-relaxed text-text-tertiary">{list.description}</p>
            )}
            <p className="mt-3 text-xs text-text-tertiary/50">{formatUpdated(list.updated_at)}</p>
            {list.is_ranked && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
                <Trophy size={10} />
                Ranked list
              </div>
            )}
          </div>

          {/* Stats panel — 4 rows */}
          <div className="shrink-0 w-64 overflow-hidden rounded-xl bg-surface-2 flex flex-col justify-around py-2">
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

      {/* ── Edit panel ── */}
      {isEditing && (
        <div className="mx-6 mb-4 space-y-3 rounded-xl border border-border-subtle bg-surface-1 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="List name"
              className="flex-1 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
            />
            <input
              type="text"
              value={editEmoji}
              onChange={(e) => setEditEmoji(e.target.value)}
              placeholder="🎬"
              className="w-14 rounded-lg border border-border-subtle bg-surface-2 px-2 py-2 text-center text-sm focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
              maxLength={2}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEditEmoji(e)}
                className={cn(
                  "rounded-md px-2 py-1 text-base transition-colors",
                  editEmoji === e ? "bg-accent-watching/20 ring-1 ring-accent-watching/40" : "hover:bg-surface-2",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-watching/30"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setEditRanked(!editRanked)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                editRanked
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-border-subtle bg-surface-2 text-text-tertiary hover:text-text-primary",
              )}
            >
              <Trophy size={12} />
              Ranked list
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateList.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-accent-watching px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {updateList.isPending && <Loader2 size={11} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter tabs + toolbar ── */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6">
        <div className="flex">
          {FILTER_TABS.filter((t) => t.key === "all" || t.count > 0).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className="relative px-4 pb-3 pt-2 text-sm font-medium transition-colors"
            >
              <span className={activeFilter === tab.key ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"}>
                {tab.label}
                {tab.key !== "all" && (
                  <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
                )}
              </span>
              {activeFilter === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-sm bg-accent-watching" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={11} className="text-text-tertiary" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="position">Order</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="rating">My rating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex rounded-lg border border-border-subtle bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "table" ? "bg-surface-2 text-text-primary" : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                view === "grid" ? "bg-surface-2 text-text-primary" : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              <LayoutGrid size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col">
        {isLoading && (
          <div className="space-y-px px-4 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-1" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            {rawItems.length === 0 ? (
              <>
                <p className="text-sm text-text-secondary">This list is empty</p>
                <p className="text-xs text-text-tertiary">Use &quot;Add title&quot; above to add from your library</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">No results</p>
                <p className="text-xs text-text-tertiary">Try a different filter or search term</p>
              </>
            )}
          </div>
        )}

        {!isLoading && items.length > 0 && view === "table" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border-subtle/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary/50">
              <div className="w-8 shrink-0 text-right">#</div>
              <div className="w-7 shrink-0" />
              <div className="min-w-0 flex-1">Title</div>
              <div className="hidden w-12 shrink-0 sm:block">Year</div>
              <div className="hidden w-20 shrink-0 md:block">Type</div>
              <div className="hidden w-16 shrink-0 lg:block">Rating</div>
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
          <div className="grid grid-cols-5 gap-4 p-6 sm:grid-cols-8 lg:grid-cols-10">
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

