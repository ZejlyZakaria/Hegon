/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { Star, TrendingUp, Sparkles, Plus } from "lucide-react";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { useWatchingHero } from "@/modules/watching/hooks/useWatchingHero";
import { useWatching } from "@/modules/watching/components/WatchingClient";
import { MoviesHeroSkeleton } from "@/modules/watching/components/WatchingSkeletons";
import type { WatchingConfig } from "@/modules/watching/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function RecoCard({ item }: { item: any }) {
  const posterUrl = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;
  return (
    <div className="flex gap-3 group cursor-pointer">
      <div className="relative w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-surface-2">
        {posterUrl && (
          <Image src={posterUrl} alt={item.title || item.name} fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="56px" />
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-medium text-text-primary truncate group-hover:text-white transition-colors">
          {item.title || item.name}
        </p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {(item.release_date || item.first_air_date)?.slice(0, 4)}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <Star size={10} className="fill-amber-400 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">
            {item.vote_average?.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function WatchingHero({ config }: { config: WatchingConfig }) {
  const { data, isLoading } = useWatchingHero(config.type);
  const { openModalWithItem } = useWatching();

  if (isLoading || !data) return <MoviesHeroSkeleton />;

  const { trending, recommendations } = data;

  const title       = trending?.title || trending?.name;
  const genres      = trending ? mapTmdbGenres(trending.genre_ids ?? []) : [];
  const backdropUrl = trending?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${trending.backdrop_path}`
    : null;
  const releaseDate = (trending?.release_date || trending?.first_air_date)?.slice(0, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-2">

      {/* ── trending hero — 2/3 sur desktop, full sur mobile ── */}
      <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-zinc-900 min-h-56 lg:min-h-64">
        {backdropUrl && (
          <Image src={backdropUrl} alt={title ?? "Trending"} fill
            className="object-cover" sizes="(max-width: 1024px) 100vw, 66vw" priority />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />

        <div className="absolute top-3 left-3 md:top-4 md:left-4 flex items-center gap-1.5 bg-violet-600/90
                        backdrop-blur-sm px-2.5 py-1 md:px-3 rounded-full text-[10px] md:text-xs font-semibold text-white">
          <TrendingUp size={11} className="md:hidden" />
          <TrendingUp size={12} className="hidden md:block" />
          <span className="hidden sm:inline">Trend this week</span>
          <span className="sm:hidden">Trend</span>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <div className="flex gap-2 mb-2 flex-wrap">
            {genres.slice(0, 3).map(g => (
              <span key={g} className="text-[9px] md:text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-text-secondary">
                {g}
              </span>
            ))}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 md:line-clamp-1">
            {title}
          </h2>
          <div className="flex items-center gap-2 md:gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Star size={12} className="fill-amber-400 text-amber-400 md:w-3.25 md:h-3.25" />
              <span className="text-xs md:text-sm font-semibold text-amber-400">
                {trending?.vote_average?.toFixed(1)}
              </span>
            </div>
            <span className="text-text-tertiary text-[10px] md:text-xs">{releaseDate}</span>
          </div>
          <p className="text-[11px] md:text-xs text-text-secondary mt-2 line-clamp-2 max-w-full lg:max-w-lg">
            {trending?.overview}
          </p>
          <button
            onClick={() => trending && openModalWithItem("recentlyWatched", trending)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium transition-colors"
          >
            <Plus size={12} />
            Add to collection
          </button>
        </div>
      </div>

      {/* ── recommendations — 1/3 sur desktop, full sur mobile ── */}
      <div className="lg:col-span-1 rounded-2xl bg-surface-1 border border-border-subtle p-4 flex flex-col gap-3 min-h-50 lg:min-h-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-violet-400 md:w-3.5 md:h-3.5" />
          <h3 className="text-xs md:text-sm font-semibold text-text-secondary">
            Don&apos;t Miss
          </h3>
        </div>

        {recommendations.length > 0 ? (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4">
            {recommendations.map((m: any) => (
              <RecoCard key={m.id} item={m} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <p className="text-[10px] md:text-xs text-text-tertiary">
              No recommendations
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
