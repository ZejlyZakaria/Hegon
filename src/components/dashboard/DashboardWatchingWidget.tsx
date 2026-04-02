"use client";

import Link from "next/link";
import { Tv, Star, Play } from "lucide-react";
import { MOCK_WATCHING } from "@/lib/dashboard/mock-data";

function formatNextEpisode(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export function DashboardWatchingWidget() {
  const { trendingMovie: movie, ongoingSeries: series, ongoingAnime: anime } = MOCK_WATCHING;

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-6 rounded-full bg-violet-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Watching</span>
        </div>
        <Link href="/perso/watching" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium">
          →
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
        {/* Trending Movie */}
        <div className="p-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Star size={9} className="text-amber-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Trending this week</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Poster placeholder */}
            <div
              className="w-10 h-14 rounded-md shrink-0 flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, #7f1d1d, #18181b)` }}
            >
              <span className="text-lg">🎬</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{movie.title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{movie.genre}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star size={9} className="text-amber-400 fill-amber-400" />
                <span className="text-[10px] text-amber-400 font-bold">{movie.rating}</span>
                <span className="text-[10px] text-zinc-600 ml-0.5">{movie.year}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ongoing Series */}
        <div className="p-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Play size={9} className="text-violet-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Series in progress</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-14 rounded-md shrink-0 flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, #78350f, #18181b)` }}
            >
              <span className="text-lg">📺</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white truncate">{series.title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                S{series.season} · E{series.episode}/{series.total_episodes} · {series.network}
              </p>
              {/* progress bar */}
              <div className="mt-1.5">
                <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${(series.episode / series.total_episodes) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-[9px] text-zinc-600 mt-1">
                Next ep: {formatNextEpisode(series.next_episode)}
              </p>
            </div>
          </div>
        </div>

        {/* Ongoing Anime */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Play size={9} className="text-blue-400" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Anime in progress</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-14 rounded-md shrink-0 flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, #1e3a5f, #18181b)` }}
            >
              <span className="text-lg">⚔️</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white truncate">{anime.title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                S{anime.season} · E{anime.episode}/{anime.total_episodes} · {anime.studio}
              </p>
              <div className="mt-1.5">
                <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(anime.episode / anime.total_episodes) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-[9px] text-zinc-600 mt-1">
                {anime.total_episodes - anime.episode} episodes remaining
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
