/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Music, Play, Shuffle } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { useThemeFavorites } from "@/modules/watching/hooks/useThemeFavorites";
import { useThemeCovers } from "@/modules/watching/hooks/useThemeCovers";
import { themeTrackKey } from "@/modules/watching/service";
import { useThemePlayer, type PlayerTrack } from "@/modules/watching/store/theme-player";

// Playing indicator — three bars breathing, Apple Music style.
function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-white"
          animate={{ height: ["30%", "100%", "45%", "85%", "35%"] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function ThemeTile({
  track, active, playing, onPlay,
}: {
  track: PlayerTrack;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group/tile w-36 shrink-0 snap-start text-left transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04] sm:w-40"
    >
      {/* Square artwork */}
      <div className={cn(
        "relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-2 ring-1 transition-shadow",
        active ? "ring-2 ring-accent-watching-vivid" : "ring-white/10",
      )}>
        {track.cover ? (
          <img src={track.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><Music size={22} className="text-white/30" /></div>
        )}

        {/* Play / equalizer overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/60 via-black/10 to-transparent transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100",
        )}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25">
            {playing ? <Equalizer /> : <Play size={16} className="translate-x-0.5 fill-white text-white" />}
          </span>
        </div>

        {/* Label chip */}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-accent-watching-vivid backdrop-blur-sm">
          {track.label}
        </span>
      </div>

      {/* Meta — song title + anime name */}
      <p className="mt-2 truncate text-[13px] font-semibold text-text-primary">{track.title}</p>
      <p className="truncate text-[11px] text-text-tertiary">{track.animeName}</p>
    </button>
  );
}

export default function MyThemesSectionClient() {
  const { data: favorites = [], isLoading } = useThemeFavorites();
  const { queue, index, isPlaying, play, toggle } = useThemePlayer();

  const coverItems = useMemo(
    () => favorites.map((f) => ({ title: f.title, artist: f.artist })),
    [favorites],
  );
  const { data: liveCovers = {} } = useThemeCovers(coverItems);

  const tracks: PlayerTrack[] = useMemo(
    () =>
      favorites.map((f) => ({
        id: f.track_key,
        label: f.label,
        title: f.title,
        artist: f.artist,
        audioUrl: f.audio_url,
        videoUrl: f.video_url,
        animeName: f.anime_name,
        // Same square cover as the detail panel + player: live iTunes lookup
        // (identical function + cache), with the stored cover/poster as instant fallback.
        cover: liveCovers[`${f.title}|${f.artist}`] ?? f.cover ?? f.anime_poster,
        animePoster: f.anime_poster,
      })),
    [favorites, liveCovers],
  );

  // Active by stable key, so a theme playing from the detail rail also lights up here.
  const current = queue[index] ?? null;
  const activeKey = current ? themeTrackKey(current) : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const refreshArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };
  useEffect(() => {
    refreshArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", refreshArrows, { passive: true });
    window.addEventListener("resize", refreshArrows);
    return () => {
      el.removeEventListener("scroll", refreshArrows);
      window.removeEventListener("resize", refreshArrows);
    };
  }, [tracks.length]);

  if (isLoading || tracks.length === 0) return null;

  const scroll = (dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "next" ? el.clientWidth * 0.8 : -el.clientWidth * 0.8, behavior: "smooth" });
  };

  const shuffle = () => {
    const q = [...tracks];
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    play(q, 0);
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <Link href="/perso/watching/themes" className="group/title inline-flex items-center gap-1 text-title text-text-primary transition-colors hover:text-accent-watching-vivid">
            My Themes
            <ChevronRight size={18} className="translate-y-px text-text-tertiary transition-[color,transform] group-hover/title:translate-x-0.5 group-hover/title:text-accent-watching-vivid" />
          </Link>
          <p className="mt-1 text-xs text-text-tertiary">
            {tracks.length} favorite {tracks.length === 1 ? "opening or ending" : "openings & endings"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("prev")}
            disabled={!canPrev}
            className={cn(
              "hidden rounded-full border border-white/10 p-2 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97] lg:block",
              canPrev ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary" : "cursor-not-allowed border-white/5 text-text-tertiary/20 opacity-50",
            )}
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll("next")}
            disabled={!canNext}
            className={cn(
              "hidden rounded-full border border-white/10 p-2 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97] lg:block",
              canNext ? "text-text-tertiary hover:bg-white/10 hover:text-text-primary" : "cursor-not-allowed border-white/5 text-text-tertiary/20 opacity-50",
            )}
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={shuffle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-text-tertiary transition-colors hover:bg-white/10 hover:text-text-primary"
            aria-label="Shuffle"
            title="Shuffle"
          >
            <Shuffle size={14} />
          </button>
          <button
            type="button"
            onClick={() => play(tracks, 0)}
            className="flex items-center gap-1.5 rounded-control px-3.5 py-1.5 text-xs font-medium text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: "var(--color-accent-watching)" }}
          >
            <Play size={12} className="fill-current" />
            Play
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth py-1.5 snap-x -mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tracks.map((track, i) => {
          const active = activeKey === track.id;
          return (
            <ThemeTile
              key={track.id}
              track={track}
              active={active}
              playing={active && isPlaying}
              onPlay={() => (active ? toggle() : play(tracks, i))}
            />
          );
        })}
      </div>
    </section>
  );
}
