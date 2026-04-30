"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreVertical,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
import MediaDetailModal from "../modals/MediaDetailModal";
import DeleteConfirmModal from "../modals/DeleteConfirmModal";

// ─── helpers ─────────────────────────────────────────────────────────────────

function computeProgress(item: WatchingMedia): number {
  if (!item.season_episodes?.length) return 0;
  const seasonIdx = (item.current_season ?? 1) - 1;
  const prevEps = item.season_episodes
    .slice(0, seasonIdx)
    .reduce((s, n) => s + n, 0);
  const total = item.season_episodes.reduce((s, n) => s + n, 0);
  return total
    ? Math.round(((prevEps + (item.current_episode ?? 0)) / total) * 100)
    : 0;
}

// ─── types ────────────────────────────────────────────────────────────────────

type MediaCarouselProps = {
  title: string;
  subtitle?: string;
  items: WatchingMedia[];
  onAddClick?: () => void;
  addCardPosition?: "start" | "end";
  draggable?: boolean;
  onReorder?: (reordered: WatchingMedia[]) => void;
  onMarkWatched?: (itemId: string) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  onUpdate?: (item: WatchingMedia) => void;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
};

// ─── priority badge ───────────────────────────────────────────────────────────

function PriorityBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  const config =
    {
      high: {
        label: "High",
        className: "bg-red-500/20 text-red-400 border-red-500/30",
      },
      medium: {
        label: "Medium",
        className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      },
      low: {
        label: "Low",
        className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
      },
    }[level] ?? null;
  if (!config) return null;
  return (
    <span
      className={cn(
        "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ─── context menu ─────────────────────────────────────────────────────────────

function CardMenu({
  item,
  onView,
  onDelete,
  onMarkWatched,
}: {
  item: WatchingMedia;
  onView: () => void;
  onDelete?: (id: string) => Promise<void>;
  onMarkWatched?: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handler de confirmation de suppression
  const handleConfirmDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
      setOpen(false);
    } catch (err) {
      console.error("Erreur suppression:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((p) => !p);
          }}
          className="p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
        >
          <MoreVertical size={14} />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-8 z-50 w-52 bg-surface-3 border border-border-default rounded-xl shadow-2xl overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-2 transition-colors text-sm text-text-secondary group"
              >
                <Pencil
                  size={13}
                  className="text-text-tertiary group-hover:text-text-secondary"
                />
                View / Edit
              </button>

              {onMarkWatched && !item.watched && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onMarkWatched(item.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-2 transition-colors text-sm text-text-secondary group"
                >
                  <Eye
                    size={13}
                    className="text-text-tertiary group-hover:text-emerald-400"
                  />
                  {item.in_progress ? "Mark as finished" : "Mark as watched"}
                </button>
              )}

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true); // ✅ MODIFIÉ : Ouvre le modal au lieu de supprimer directement
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-500/10 transition-colors text-sm text-red-400 group border-t border-border-default"
                >
                  <Trash2
                    size={13}
                    className="text-red-400/70 group-hover:text-red-400"
                  />
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ✅ AJOUTÉ : Modal de confirmation de suppression */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete "${item.title}"?`}
        description="This media will be permanently deleted from your collection."
        isDeleting={isDeleting}
      />
    </>
  );
}
// ─── movie card ───────────────────────────────────────────────────────────────

function MovieCard({
  item,
  onView,
  onDelete,
  onMarkWatched,
  showEpisodeBadge,
  showRankBadge,
}: {
  item: WatchingMedia;
  onView: () => void;
  onDelete?: (id: string) => Promise<void>;
  onMarkWatched?: (id: string) => Promise<void>;
  showEpisodeBadge?: boolean;
  showRankBadge?: boolean;
}) {
  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl border border-white/10 cursor-pointer"
      onClick={onView}
    >
      <div className="relative aspect-video">
        <Image
          src={item.backdrop_url || item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
          quality={75}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />

        {/* rank badge — top10 only */}
        {showRankBadge && item.priority && (
          <div className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black border-2 border-white text-xs font-bold text-white shadow-lg z-10">
            {item.priority}
          </div>
        )}

        {/* priority badge — À voir only */}
        {item.want_to_watch && item.priority_level && (
          <div className="absolute top-3 left-3 z-10">
            <PriorityBadge level={item.priority_level} />
          </div>
        )}

        {item.favorite && (
          <div className="absolute top-3 right-10">
            <Heart size={16} className="fill-red-500 text-red-500" />
          </div>
        )}

        {/* context menu — toujours visible mobile, hover seulement desktop */}
        <div
          className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <CardMenu
            item={item}
            onView={onView}
            onDelete={onDelete}
            onMarkWatched={onMarkWatched}
          />
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <h4 className="text-sm font-semibold text-white line-clamp-1">
            {item.title}
          </h4>

          {/* episode progress */}
          {showEpisodeBadge &&
            item.current_episode != null &&
            item.current_episode > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  {"S" +
                    String(item.current_season ?? 1).padStart(2, "0") +
                    " E" +
                    String(item.current_episode).padStart(2, "0")}
                </span>
                {computeProgress(item) > 0 && (
                  <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${computeProgress(item)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

          <div className="mt-1.5 flex items-center gap-2 min-w-0">
            {item.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white max-w-20 truncate"
              >
                {tag}
              </span>
            ))}
            <span className="text-xs text-text-tertiary shrink-0">
              {item.year}
            </span>

            {item.user_rating != null && item.user_rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-white shrink-0">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {item.user_rating}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── add card ─────────────────────────────────────────────────────────────────

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="shrink-0 w-full cursor-pointer">
      <div className="group relative w-full overflow-hidden rounded-xl border border-white/20 bg-linear-to-br from-zinc-900 to-black hover:border-white/40 transition-all duration-300 flex items-center justify-center aspect-video">
        <div className="flex flex-col items-center justify-center gap-3 text-white/70 group-hover:text-white transition-colors">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md group-hover:bg-white/20 transition-all duration-300 shadow-lg">
            <Plus size={28} className="text-white/90 group-hover:text-white" />
          </div>
          <span className="text-sm font-medium">Add</span>
        </div>
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function MediaCarousel({
  title,
  subtitle,
  items,
  onAddClick,
  addCardPosition = "start",
  onMarkWatched,
  onDelete,
  onUpdate,
  showEpisodeBadge = false,
  showRankBadge = false,
}: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(5);
  const [selectedItem, setSelectedItem] = useState<WatchingMedia | null>(null);
  const [localItems, setLocalItems] = useState(items);
  const gap = 16;

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) setCardsPerView(1);
      else if (w < 1024) setCardsPerView(2);
      else if (w < 1280) setCardsPerView(3);
      else setCardsPerView(5);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sortedItems = useMemo(
    () =>
      [...localItems].sort((a, b) => (a.priority || 999) - (b.priority || 999)),
    [localItems],
  );

  const totalElements = onAddClick
    ? sortedItems.length + 1
    : sortedItems.length;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < totalElements - cardsPerView;

  const scroll = (direction: "prev" | "next") => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const cardWidth =
      (containerWidth - (cardsPerView - 1) * gap) / cardsPerView;
    let newIndex = currentIndex;
    if (direction === "prev" && canGoPrev) newIndex--;
    else if (direction === "next" && canGoNext) newIndex++;
    scrollRef.current.scrollTo({
      left: newIndex * (cardWidth + gap),
      behavior: "smooth",
    });
    setCurrentIndex(
      Math.min(newIndex, Math.max(0, totalElements - cardsPerView)),
    );
  };

  const itemWidthStyle = {
    width: `calc((100% - ${(cardsPerView - 1) * gap}px) / ${cardsPerView})`,
  };

  const AddCardWrapper = onAddClick ? (
    <div className="shrink-0 snap-start" style={itemWidthStyle}>
      <AddCard onClick={onAddClick} />
    </div>
  ) : null;

  if (localItems.length === 0) {
    return (
      <section className="mb-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>
            )}
          </div>
        </div>
        <div
          className="rounded-xl border border-border-subtle bg-surface-1 flex flex-col items-center justify-center gap-3 py-12 cursor-pointer group hover:border-border-default transition-colors"
          onClick={onAddClick}
        >
          {onAddClick ? (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                <Plus
                  size={22}
                  className="text-text-tertiary group-hover:text-text-secondary transition-colors"
                />
              </div>
              <p className="text-sm text-text-tertiary group-hover:text-text-secondary transition-colors">
                Add your first item
              </p>
            </>
          ) : (
            <p className="text-sm text-text-tertiary">Nothing here yet</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-text-tertiary">{subtitle}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => canGoPrev && scroll("prev")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-all duration-300",
              canGoPrev
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => canGoNext && scroll("next")}
            className={cn(
              "rounded-full border border-white/10 p-2 transition-all duration-300",
              canGoNext
                ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary cursor-pointer"
                : "text-text-tertiary/20 border-white/5 cursor-not-allowed opacity-50",
            )}
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {onAddClick && addCardPosition === "start" && AddCardWrapper}

        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="shrink-0 snap-start transition-all duration-500 ease-in-out"
            style={itemWidthStyle}
          >
            <MovieCard
              item={item}
              onView={() => setSelectedItem(item)}
              onDelete={onDelete}
              onMarkWatched={onMarkWatched}
              showEpisodeBadge={showEpisodeBadge}
              showRankBadge={showRankBadge}
            />
          </div>
        ))}

        {onAddClick && addCardPosition === "end" && AddCardWrapper}
      </div>

      {selectedItem && (
        <MediaDetailModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onUpdate={(item) => {
            onUpdate?.(item);
            setSelectedItem(null);
          }}
          onDelete={
            onDelete
              ? (id) => {
                  onDelete(id);
                  setSelectedItem(null);
                }
              : undefined
          }
        />
      )}
    </section>
  );
}
