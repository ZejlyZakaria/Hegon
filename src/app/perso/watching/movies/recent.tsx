/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import MediaSmallCard from "@/components/watching/MediaSmallCard";

//  Types
interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

type GenresMap = Record<number, string>;

//  Skeleton
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

//  Component
const Recent = () => {
  const [recentMovies, setRecentMovies] = useState<TMDBMovie[]>([]);
  const [genresMap, setGenresMap] = useState<GenresMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        /* Fetch genres */
        const genresRes = await fetch(
          `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`,
          { signal: controller.signal },
        );
        if (!genresRes.ok) throw new Error("Erreur genres");

        const genresData = await genresRes.json();
        const map: GenresMap = {};
        genresData.genres.forEach((g: { id: number; name: string }) => {
          map[g.id] = g.name;
        });
        setGenresMap(map);

        /* Fetch recent movies */
        const today = new Date().toISOString().split("T")[0];
        const moviesUrl =
          `https://api.themoviedb.org/3/discover/movie` +
          `?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}` +
          `&language=fr-FR` +
          `&sort_by=primary_release_date.desc` +
          `&vote_average.gte=7` +
          `&vote_count.gte=50` +
          `&primary_release_date.lte=${today}` +
          `&include_adult=false` +
          `&page=1`;

        const moviesRes = await fetch(moviesUrl, {
          signal: controller.signal,
        });
        if (!moviesRes.ok) throw new Error("Erreur films");

        const moviesData = await moviesRes.json();
        setRecentMovies(moviesData.results?.slice(0, 3) || []);
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
  }, []);

  //  States
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
      <h2 className="text-lg font-bold mb-4 text-gray-300">Recent Movies</h2>

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {recentMovies.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun film récent de qualité trouvé.
          </p>
        ) : (
          recentMovies.map((movie) => (
            <MediaSmallCard
              key={movie.id}
              media={movie}
              genresMap={genresMap}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Recent;
