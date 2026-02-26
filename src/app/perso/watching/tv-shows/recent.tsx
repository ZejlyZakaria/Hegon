/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import MediaSmallCard from "@/components/watching/MediaSmallCard";

/* Types */
interface TMDBTV {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

type GenresMap = Record<number, string>;

/* Skeleton */
const RecentSkeleton = () => {
  return (
    <div className="w-full rounded-xl bg-zinc-900 p-4 animate-pulse">
      <div className="h-6 w-1/2 bg-zinc-800 rounded mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-5 gap-3 items-center">
            <div className="col-span-1 h-[14vh] bg-zinc-800 rounded-lg" />
            <div className="col-span-4 space-y-2">
              <div className="h-4 w-3/4 bg-zinc-800 rounded" />
              <div className="h-3 w-1/3 bg-zinc-800 rounded" />
              <div className="h-3 w-1/4 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Component générique */
interface RecentBaseProps {
  title: string;
  extraQuery?: string; // Ici on peut passer des filtres spéciaux
}

const RecentBase = ({ title, extraQuery }: RecentBaseProps) => {
  const [recentTV, setRecentTV] = useState<TMDBTV[]>([]);
  const [genresMap, setGenresMap] = useState<GenresMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        // Genres TV
        const genresRes = await fetch(
          `https://api.themoviedb.org/3/genre/tv/list?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`,
          { signal: controller.signal },
        );
        if (!genresRes.ok) throw new Error("Erreur genres");
        const genresData = await genresRes.json();
        const map: GenresMap = {};
        genresData.genres.forEach((g: { id: number; name: string }) => {
          map[g.id] = g.name;
        });
        setGenresMap(map);

        // Recent TV Shows / Anime
        const today = new Date().toISOString().split("T")[0];
        const tvUrl =
          `https://api.themoviedb.org/3/discover/tv` +
          `?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}` +
          `&language=fr-FR` +
          `&sort_by=first_air_date.desc` +
          `&vote_average.gte=8` +
          `&vote_count.gte=50` +
          `&first_air_date.lte=${today}` +
          `&include_adult=false` +
          `&page=1` +
          (extraQuery ? `&${extraQuery}` : "");

        const tvRes = await fetch(tvUrl, { signal: controller.signal });
        if (!tvRes.ok) throw new Error("Erreur séries");
        const tvData = await tvRes.json();
        setRecentTV(tvData.results?.slice(0, 3) || []);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur inconnue");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [extraQuery]);

  if (loading) return <RecentSkeleton />;

  if (error) {
    return (
      <div className="w-full rounded-xl bg-gray-200 p-4 text-red-500">
        Erreur : {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl flex flex-col">
      <h2 className="text-lg font-bold mb-4 text-gray-300">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {recentTV.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune série récente de qualité trouvée.
          </p>
        ) : (
          recentTV.map((tv) => (
            <MediaSmallCard
              key={tv.id}
              media={{
                id: tv.id,
                title: tv.name,
                poster_path: tv.poster_path,
                release_date: tv.first_air_date,
                vote_average: tv.vote_average,
                vote_count: tv.vote_count,
                genre_ids: tv.genre_ids,
              }}
              genresMap={genresMap}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RecentBase;
