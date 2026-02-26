/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";

  //  Types
interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date: string;
  genre_ids: number[];
}

  //  Skeleton Component
const TrendingSkeleton = () => {
  return (
    <div className="min-h-[50vh] w-full rounded-xl overflow-hidden bg-zinc-900 animate-pulse relative">
      <div className="absolute inset-0  to-transparent" />

      <div className="absolute bottom-0 w-full p-6 md:p-10 space-y-4">
        <div className="h-10 w-2/3 bg-zinc-800 rounded-md" />
        <div className="h-4 w-1/2 bg-zinc-800 rounded-md" />
        <div className="h-4 w-full bg-zinc-800 rounded-md" />
        <div className="h-4 w-5/6 bg-zinc-800 rounded-md" />
        <div className="h-12 w-44 bg-zinc-800 rounded-lg mt-4" />
      </div>
    </div>
  );
};

  //  Main Component
const Trending = () => {
  const [trendingMovie, setTrendingMovie] = useState<TMDBMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchTrendingUS = async () => {
      try {
        const url =
          `https://api.themoviedb.org/3/discover/movie` +
          `?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}` +
          `&language=fr-FR` +
          `&region=US` +
          `&sort_by=popularity.desc` +
          `&primary_release_date.gte=2026-01-01` +
          `&vote_count.gte=50` +
          `&page=1`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Erreur TMDB: ${res.status}`);

        const data = await res.json();

        if (data.results?.length > 0) {
          setTrendingMovie(data.results[0]);
        } else {
          setError("Aucun film correspondant trouvé");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingUS();

    return () => controller.abort();
  }, []);

    //  States
  if (loading) return <TrendingSkeleton />;

  if (error || !trendingMovie) {
    return (
      <div className="min-h-[50vh] w-full rounded-xl bg-zinc-900 flex items-center justify-center text-red-600">
        {/* {error || "Aucun film disponible"} */}
        {error}
      </div>
    );
  }

  const backdropUrl = trendingMovie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${trendingMovie.backdrop_path}`
    : "/placeholder-backdrop.jpg";

  const shortOverview =
    trendingMovie.overview?.length > 220
      ? trendingMovie.overview.slice(0, 220) + "..."
      : trendingMovie.overview || "Aucune description disponible.";

  return (
    <div className="min-h-[56vh] w-full relative overflow-hidden rounded-xl">
      {/* Background Image */}
      <Image
        src={backdropUrl}
        alt={`Backdrop de ${trendingMovie.title}`}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 768px) 100vw, 66vw"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 lg:p-10">
        {/* Title */}
        {/* <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-2 md:mb-3"> */}
        <div className="text-xl sm:text-xl md:text-2xl lg:text-4xl font-bold text-white  mb-2 md:mb-3">
          {trendingMovie.title}
        </div>

        {/* Meta infos */}
        <div className="flex items-center gap-3 md:gap-4 text-xs sm:text-sm md:text-base text-gray-200 mb-3 md:mb-4">
          <span className="flex items-center gap-1">
            <Star
              size={14}
              className="md:w-4 md:h-4 lg:w-5 lg:h-5"
              fill="#FF5C00"
              stroke="none"
            />
            {trendingMovie.vote_average.toFixed(1)}
          </span>
          <span>{new Date(trendingMovie.release_date).getFullYear()}</span>
        </div>

        {/* Description → cachée en md */}
        <p className="hidden lg:block text-sm lg:text-md text-gray-100 max-w-3xl mb-4 lg:mb-6">
          {shortOverview}
        </p>

        {/* Button */}
        <button
          className="
            w-fit
            px-4 py-2
            sm:px-5 sm:py-2.5
            md:px-6 md:py-3
            lg:px-7 lg:py-3.5
            text-xs sm:text-sm md:text-base
            font-semibold
            text-white
            border border-white
            bg-transparent
            rounded-lg
            hover:bg-white hover:text-black
            transition-all duration-200
            active:scale-95
          "
          onClick={() => alert("Ajout à ma liste (bientôt 👀)")}
        >
          Ajouter à ma liste
        </button>
      </div>
    </div>
  );
};

export default Trending;
