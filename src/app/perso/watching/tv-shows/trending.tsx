/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";

interface TMDBTV {
  id: number;
  name: string;
  overview: string;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date: string;
  genre_ids: number[];
}

interface TrendingBaseProps {
  variant: "tv" | "anime";
}

const TrendingBase = ({ variant }: TrendingBaseProps) => {
  const [data, setData] = useState<TMDBTV | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        let baseQuery = `
          sort_by=popularity.desc&
          page=1
        `;

        // 🔵 TV classique (exactement comme ton ancien composant)
        if (variant === "tv") {
          baseQuery += `
            &region=US
            &first_air_date.gte=2026-01-01
            &vote_count.gte=50
          `;
        }

        // 🔴 Anime
        if (variant === "anime") {
          baseQuery += `
            &with_genres=16
            &with_origin_country=JP
          `;
        }

        const url =
          `https://api.themoviedb.org/3/discover/tv` +
          `?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}` +
          `&language=fr-FR&${baseQuery}`;

        console.log("URL:", url); // debug

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Erreur TMDB: ${res.status}`);

        const json = await res.json();

        if (json.results?.length > 0) {
          setData(json.results[0]);
        } else {
          setError("Aucune série correspondante trouvée");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [variant]);

  if (loading) {
    return (
      <div className="min-h-[50vh] w-full rounded-xl bg-zinc-900 animate-pulse" />
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[50vh] w-full rounded-xl bg-zinc-900 flex items-center justify-center text-red-600">
        {/* {error || "Aucune série disponible"} */}
        {error}
      </div>
    );
  }

  const backdropUrl = data.backdrop_path
    ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
    : "/placeholder-backdrop.jpg";

  const shortOverview =
    data.overview?.length > 220
      ? data.overview.slice(0, 220) + "..."
      : data.overview || "Aucune description disponible.";

  return (
    <div className="min-h-[56vh] w-full relative overflow-hidden rounded-xl">
      <Image
        src={backdropUrl}
        alt={`Backdrop de ${data.name}`}
        fill
        className="object-cover"
        priority
      />

      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-8">
        <h2 className="text-3xl font-bold text-white mb-2">{data.name}</h2>

        <div className="flex items-center gap-4 text-sm text-gray-200 mb-4">
          <span className="flex items-center gap-1">
            <Star size={16} fill="#FF5C00" stroke="none" />
            {data.vote_average.toFixed(1)}
          </span>
          <span>{new Date(data.first_air_date).getFullYear()}</span>
        </div>

        <p className="hidden lg:block text-gray-100 max-w-3xl mb-6">
          {shortOverview}
        </p>

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

export default TrendingBase;
