"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { tmdbImageFor } from "../../lib/tmdb-image";
import { MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { LoveMark, ScoreMark, OVERLAY_CIRCLE, OVERLAY_CLUSTER } from "@/modules/watching/components/shared/Marks";
import type { WatchingMedia } from "@/modules/watching/types";
import { displayTitle } from "@/modules/watching/utils";
import { posterStatus, PosterStatusBadge } from "@/modules/watching/components/shared/StatusBadge";

interface Props {
  item: WatchingMedia;
  onClick: () => void;
  onDelete?: () => void;
  eagerLoad?: boolean;
}

const MENU_W = 176; // w-44 — the portaled dropdown's width, used to keep it on-screen

export default function LibraryCard({ item, onClick, onDelete, eagerLoad }: Props) {
  const badge = posterStatus(item);
  // The route skeleton hands over the moment the data lands, but the POSTERS are still in flight.
  // Every other card in this module carries its own pulse for exactly that gap; this one didn't, so
  // the grid went from 93 pulsing tiles to none, and sat as frozen black rectangles — titles and
  // badges already drawn — for the ~2s the images took. A skeleton must hand over to something
  // still loading, not to a stopped picture.
  const [posterLoaded, setPosterLoaded] = useState(false);
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
      // Clamp so the (left-growing, w-44 = 176px) menu stays on-screen — the first grid item on
      // mobile sits near the left edge, where `innerWidth - rect.right` alone cut the menu off.
      const desiredRight = window.innerWidth - rect.right;
      const maxRight = window.innerWidth - MENU_W - 8;
      setMenuPos({ top: rect.bottom + 4, right: Math.max(8, Math.min(desiredRight, maxRight)) });
    }
    setMenuOpen((p) => !p);
  };

  return (
    <div className="group relative cursor-pointer" onClick={onClick}>
      {/* image */}
      <div
        className={cn(
          "relative aspect-2/3 overflow-hidden rounded-tile bg-surface-2 transition-transform duration-300 ease-out group-hover:z-10 group-hover:scale-[1.04]",
          !posterLoaded && "animate-pulse",
        )}
      >
        <Image
          src={tmdbImageFor(item.poster_url, 200) || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover transition-opacity duration-300"
          style={{ opacity: posterLoaded ? 1 : 0 }}
          sizes="(max-width: 768px) 33vw, 200px"
          loading={eagerLoad ? "eager" : "lazy"}
          priority={eagerLoad}
          onLoad={() => setPosterLoaded(true)}
        />

        {/* THE TWO CLUSTERS — and they must live in the SAME box. The heart used to sit
            inside this (scaling) image while the menu sat outside it, so the moment you
            hovered, one grew and the other didn't: two marks on the same line, drifting
            apart. Same parent, same inset, same 24px height → aligned by construction, at
            rest and in motion. (The menu portals its dropdown, so `overflow-hidden` here
            can't clip it.) */}
        {item.favorite && (
          <div className={cn(OVERLAY_CLUSTER, "left-2.5")}>
            <span className={OVERLAY_CIRCLE}>
              <LoveMark size={12} />
            </span>
          </div>
        )}

        <div
          className={cn(OVERLAY_CLUSTER, "right-2.5 opacity-100 transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100")}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={btnRef}
            type="button"
            onClick={handleMenuOpen}
            className={cn(OVERLAY_CIRCLE, "text-white/75 transition-colors hover:text-white")}
          >
            <MoreVertical size={13} />
          </button>
        </div>

        {badge && <PosterStatusBadge status={badge} />}
      </div>

      {/* dropdown — portal so it escapes all stacking contexts */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-200 w-44 overflow-hidden rounded-card border border-border-strong bg-surface-3 py-1 shadow-md"
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
        {/* Score first, year second — the verdict leads, the fact trails. (They were the other
            way round, which put the dullest number on the card in the eye's first stop.) */}
        <div className="mt-0.5 flex items-center justify-between text-micro text-text-tertiary">
          {item.user_rating != null && item.user_rating > 0 ? (
            <ScoreMark value={item.user_rating} source="mine" />
          ) : (
            <span />
          )}
          <span>{item.year}</span>
        </div>
      </div>
    </div>
  );
}
