"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Star, Heart, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { displayTitle } from "@/modules/watching/utils";

interface Props {
  item: WatchingMedia;
  onClick: () => void;
  onDelete?: () => void;
  eagerLoad?: boolean;
}

export default function LibraryCard({ item, onClick, onDelete, eagerLoad }: Props) {
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
      <div className="relative aspect-2/3 overflow-hidden rounded-lg">
        <Image
          src={item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          unoptimized
          className="object-cover transition-transform duration-300 group-hover:scale-105"
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

        {/* hover overlay with rating */}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          {item.user_rating != null && item.user_rating > 0 && (
            <div className="flex items-center gap-1 text-white">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold">{item.user_rating}/10</span>
            </div>
          )}
        </div>
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
          className="fixed z-200 w-44 overflow-hidden rounded-xl border border-border-strong bg-surface-3 py-1 shadow-2xl"
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

      {/* title + year */}
      <div className="mt-2 px-0.5">
        <h4 className="text-xs font-medium text-text-primary line-clamp-1">{displayTitle(item)}</h4>
        <p className="mt-0.5 text-[10px] text-text-tertiary">{item.year}</p>
      </div>
    </div>
  );
}
