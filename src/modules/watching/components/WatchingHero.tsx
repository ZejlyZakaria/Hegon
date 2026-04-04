/* eslint-disable @typescript-eslint/no-explicit-any */
// components/watching/WatchingHero.tsx
import Image from "next/image";
import { Star, TrendingUp, Sparkles } from "lucide-react";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import type { WatchingConfig } from "@/modules/watching/types";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";

// ─── recommendation card ──────────────────────────────────────────────────────

function RecoCard({ item }: { item: any }) {
  const posterUrl = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;
  return (
    <div className="flex gap-3 group cursor-pointer">
      <div className="relative w-14 h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
        {posterUrl && (
          <Image src={posterUrl} alt={item.title || item.name} fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="56px" />
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
          {item.title || item.name}
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildTrendingUrl(config: WatchingConfig, key: string): string {
  if (config.type === "anime") {
    // trending anime — discover/tv filtré Animation + Japon
    const p = new URLSearchParams({
      api_key: key, language: "fr-FR",
      sort_by: "popularity.desc",
      with_genres: "16",
      with_origin_country: "JP",
      "vote_average.gte": "7",
      "vote_count.gte": "100",
    });
    return `${TMDB_BASE}/discover/tv?${p}`;
  }
  
  // ✅ SÉRIES : Exclure les animes (genre 16 Animation)
  if (config.type === "serie") {
    const p = new URLSearchParams({
      api_key: key,
      language: "fr-FR",
      sort_by: "popularity.desc",
      without_genres: "16",  // ✅ EXCLURE Animation
      "vote_average.gte": "7",
      "vote_count.gte": "100",
    });
    return `${TMDB_BASE}/discover/tv?${p}`;
  }
  
  // movies — trending endpoint standard
  const p = new URLSearchParams({ api_key: key, language: "fr-FR" });
  return `${TMDB_BASE}/${config.tmdbTrendingEndpoint}?${p}`;
}

function buildRecoUrl(config: WatchingConfig, key: string): string {
  const base: Record<string, string> = {
    api_key: key,
    language: "fr-FR",
    "vote_average.gte": "7.5",
    "vote_count.gte": "50",
    sort_by: "release_date.desc",
    page: "1",
  };

  if (config.type === "film") {
    const p = new URLSearchParams(base);
    return `${TMDB_BASE}/discover/movie?${p}`;
  }

  if (config.type === "serie") {
    // ✅ SÉRIES : Exclure les animes des recommandations aussi
    const p = new URLSearchParams({ 
      ...base, 
      sort_by: "first_air_date.desc",
      without_genres: "16"  // ✅ EXCLURE Animation
    });
    return `${TMDB_BASE}/discover/tv?${p}`;
  }

  // anime
  const p = new URLSearchParams({
    ...base,
    sort_by: "first_air_date.desc",
    with_genres: "16",
    with_origin_country: "JP",
  });
  return `${TMDB_BASE}/discover/tv?${p}`;
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default async function WatchingHero({ config }: { config: WatchingConfig }) {
  const key = process.env.TMDB_API_KEY!;

  const [trendingRes, recoRes] = await Promise.all([
    fetch(buildTrendingUrl(config, key), { next: { revalidate: 3600 } }),
    fetch(buildRecoUrl(config, key),     { next: { revalidate: 3600 } }),
  ]);

  const trendingData = trendingRes.ok ? await trendingRes.json() : { results: [] };
  const recoData     = recoRes.ok     ? await recoRes.json()     : { results: [] };

  // pick best trending
  const trending = (trendingData.results ?? []).find(
    (m: any) => m.vote_average >= 7 && m.vote_count >= 100
  ) ?? trendingData.results?.[0] ?? null;

  // 3 recommendations — already filtered by URL params
  const recommendations = (recoData.results ?? []).slice(0, 3);

  const title       = trending?.title || trending?.name;
  const genres      = trending ? mapTmdbGenres(trending.genre_ids ?? []) : [];
  const backdropUrl = trending?.backdrop_path
    ? `https://image.tmdb.org/t/p/original${trending.backdrop_path}`
    : null;
  const releaseDate = (trending?.release_date || trending?.first_air_date)?.slice(0, 4);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-2">

      {/* ── trending hero — 2/3 sur desktop, full sur mobile ── */}
      <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-zinc-900 min-h-70 lg:min-h-80">
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

        <div className="absolute bottom-0 inset-x-0 p-4 md:p-5">
          <div className="flex gap-2 mb-2 flex-wrap">
            {genres.slice(0, 3).map(g => (
              <span key={g} className="text-[9px] md:text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-zinc-300">
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
            <span className="text-zinc-500 text-[10px] md:text-xs">{releaseDate}</span>
          </div>
          <p className="text-[11px] md:text-xs text-zinc-400 mt-2 line-clamp-2 max-w-full lg:max-w-lg">
            {trending?.overview}
          </p>
        </div>
      </div>

      {/* ── recommendations — 1/3 sur desktop, full sur mobile ── */}
      <div className="lg:col-span-1 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 p-4 md:p-5 flex flex-col gap-3 md:gap-4 min-h-50 lg:min-h-0">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-violet-400 md:w-3.5 md:h-3.5" />
          <h3 className="text-xs md:text-sm font-semibold text-zinc-300">
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
            <p className="text-[10px] md:text-xs text-zinc-600">
              Aucune recommandation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}




