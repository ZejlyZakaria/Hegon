"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Star, Heart, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { displayTitle } from "@/modules/watching/utils";
import { cn } from "@/shared/utils/utils";

// Status badge shown on the poster: "Watching" (with S·E position for series) or
// "Dropped". Completed titles carry no badge — they're the library's default state.
function statusBadge(item: WatchingMedia): { label: string; tone: "watching" | "paused" | "dropped" } | null {
  if (item.dropped) return { label: "Dropped", tone: "dropped" };
  if (item.paused) return { label: "Paused", tone: "paused" };
  if (item.in_progress) {
    const isSeries = item.type === "serie" || item.type === "anime";
    const label = isSeries && item.current_season
      ? `S${item.current_season} · E${item.current_episode ?? 0}`
      : "Watching";
    return { label, tone: "watching" };
  }
  return null;
}

interface Props {
  item: WatchingMedia;
  onClick: () => void;
  onDelete?: () => void;
  eagerLoad?: boolean;
}

export default function LibraryCard({ item, onClick, onDelete, eagerLoad }: Props) {
  const badge = statusBadge(item);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [menuOpen]);

  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen((p) => !p);
  };

  return (
    <div className="group relative cursor-pointer" onClick={onClick}>
      {/* image */}
      <div className="relative aspect-2/3 overflow-hidden rounded-tile transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]">
        <Image
          src={item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          loading={eagerLoad ? "eager" : "lazy"}
          priority={eagerLoad}
        />

        {/* favorite badge */}
        {item.favorite && (
          <div className="absolute top-2 left-2 z-10">
            <Heart size={13} className="fill-red-500 text-red-500 drop-shadow" />
          </div>
        )}

        {/* status badge — Watching (with position) / Dropped */}
        {badge && (
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <span className={cn(
              "inline-block max-w-full truncate rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm ring-1 ring-white/10",
              badge.tone === "watching" ? "text-accent-watching-vivid"
                : badge.tone === "paused" ? "text-sky-300"
                : "text-amber-300",
            )}>
              {badge.label}
            </span>
          </div>
        )}

      </div>

      {/* action menu trigger */}
      <div
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={handleMenuOpen}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white/70 backdrop-blur-sm hover:text-white transition-colors"
        >
          <MoreVertical size={11} />
        </button>
      </div>

      {/* dropdown — portal so it escapes all stacking contexts */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-200 w-44 overflow-hidden rounded-xl border border-border-strong bg-surface-3 py-1 shadow-md"
          style={{ top: menuPos.top, right: menuPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); setMenuOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2 transition-colors"
          >
            <ExternalLink size={12} className="text-text-tertiary shrink-0" />
            View details
          </button>

          {onDelete && (
            <>
              <div className="my-1 h-px bg-border-default" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} className="shrink-0" />
                Delete permanently
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* title + year · rating */}
      <div className="mt-2 px-0.5">
        <h4 className="text-xs font-medium text-text-primary line-clamp-1">{displayTitle(item)}</h4>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-text-tertiary">
          <span>{item.year}</span>
          {item.user_rating != null && item.user_rating > 0 && (
            <span className="flex items-center gap-1">
              <Star size={9} className="fill-amber-400 text-amber-400" />
              {item.user_rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
