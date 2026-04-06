"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { DashboardMedia } from "../../types";

// ─── Config ───────────────────────────────────────────────────────────────────

const MEDIA_BADGE: Record<string, string> = {
  serie: "SERIES",
  anime: "ANIME",
  film:  "MOVIE",
};

const MEDIA_BADGE_STYLE: Record<string, string> = {
  serie: "bg-violet-500/15 border-violet-500/25 text-violet-400",
  anime: "bg-pink-500/15 border-pink-500/25 text-pink-400",
  film:  "bg-blue-500/15 border-blue-500/25 text-blue-400",
};

const MEDIA_HOVER_BORDER: Record<string, string> = {
  serie: "hover:border-violet-500/40",
  anime: "hover:border-pink-500/40",
  film:  "hover:border-blue-500/40",
};

const MEDIA_PROGRESS_COLOR: Record<string, string> = {
  serie: "from-violet-500 to-purple-400",
  anime: "from-pink-500 to-rose-400",
  film:  "from-blue-500 to-sky-400",
};

// ─── Progress calculation (season-aware) ─────────────────────────────────────

function calcProgress(media: DashboardMedia): { progress: number | null; epLeft: number | null } {
  if (!media.current_episode || !media.episodes) return { progress: null, epLeft: null };

  let totalWatched = media.current_episode;

  if (media.season_episodes && media.current_season && media.current_season > 1) {
    const completedEps = media.season_episodes
      .slice(0, media.current_season - 1)
      .reduce((sum, n) => sum + n, 0);
    totalWatched = completedEps + media.current_episode;
  }

  return {
    progress: Math.round((totalWatched / media.episodes) * 100),
    epLeft: media.episodes - totalWatched,
  };
}

// ─── Media card ───────────────────────────────────────────────────────────────

function MediaCard({ media, isActive }: { media: DashboardMedia; isActive: boolean }) {
  const { progress, epLeft } = calcProgress(media);

  const bgImage = media.backdrop_url ?? media.poster_url;
  const hoverBorder = MEDIA_HOVER_BORDER[media.type] ?? "hover:border-white/20";
  const progressColor = MEDIA_PROGRESS_COLOR[media.type] ?? MEDIA_PROGRESS_COLOR.film;

  const reveal = [
    "transition-[opacity,transform] duration-300 ease-in-out",
    isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none select-none",
  ].join(" ");

  return (
    <Link
      href="/perso/watching"
      className={`group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 flex flex-col h-full min-h-40 transition-colors ${hoverBorder}`}
    >
      {bgImage && (
        <Image src={bgImage} alt={media.title} fill unoptimized className="object-cover" />
      )}
      <div className="absolute inset-0 bg-linear-to-l from-transparent via-zinc-950/70 to-zinc-950" />
      <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative p-3 flex flex-col justify-between flex-1 pb-4">
        <span className={`self-start text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${MEDIA_BADGE_STYLE[media.type] ?? MEDIA_BADGE_STYLE.film}`}>
          {MEDIA_BADGE[media.type] ?? media.type}
        </span>

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-white leading-snug truncate">{media.title}</h4>

          {/* Episode info — reveal on hover */}
          <div className={`h-4 flex items-center ${reveal}`}>
            {media.current_season && media.current_episode ? (
              <p className="text-[11px] text-zinc-400 leading-none">
                S{media.current_season} · E{media.current_episode}
                {epLeft !== null && (
                  <span className="text-zinc-500"> · {epLeft} ep left</span>
                )}
              </p>
            ) : null}
          </div>

          {/* Progress % — reveal on hover */}
          <div className={`h-4 flex items-center ${reveal}`}>
            {progress !== null && (
              <p className="text-[10px] text-zinc-500 leading-none">{progress}%</p>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar — always visible */}
      {progress !== null && (
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10">
          <div
            className={`h-full bg-linear-to-r ${progressColor} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface Props {
  mediaList: DashboardMedia[];
}

export default function ContinueWatchingSection({ mediaList }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!mediaList.length) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-3.5 rounded-full bg-violet-400" />
            <h2 className="text-base font-semibold text-white tracking-tight">Currently Watching</h2>
          </div>
          <Link href="/perso/watching" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            View all →
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 flex flex-col items-center justify-center min-h-40 gap-2">
          <p className="text-sm text-zinc-500">Nothing in progress</p>
          <Link href="/perso/watching" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Browse your watchlist →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-3.5 rounded-full bg-violet-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">Currently Watching</h2>
          <span className="text-xs text-zinc-500 italic">· pick up where you left off</span>
        </div>
        <Link href="/perso/watching" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          View all →
        </Link>
      </div>

      {/* Accordion */}
      <div
        className="flex gap-3"
        onMouseLeave={() => setActiveIndex(0)}
      >
        {mediaList.map((media, i) => (
          <div
            key={media.id}
            className="min-w-24"
            style={{
              flexGrow: activeIndex === i ? 45 : 27.5,
              flexShrink: 1,
              flexBasis: "0%",
              transition: "flex-grow 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <MediaCard media={media} isActive={activeIndex === i} />
          </div>
        ))}
      </div>
    </div>
  );
}
