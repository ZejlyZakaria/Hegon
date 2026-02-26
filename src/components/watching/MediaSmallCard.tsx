import React from "react";
import { Star, Users } from "lucide-react";
import Image from "next/image";

interface MediaItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
}

interface MediaSmallCardProps {
  media: MediaItem;
  genresMap: Record<number, string>;
}

const MediaSmallCard = ({ media, genresMap }: MediaSmallCardProps) => {
  const posterUrl = media.poster_path
    ? `https://image.tmdb.org/t/p/w300${media.poster_path}`
    : "/placeholder-movie.jpg";

  const mainGenre =
    media.genre_ids && media.genre_ids.length > 0
      ? genresMap[media.genre_ids[0]] || "Inconnu"
      : "N/A";

  return (
    <div className="bg-[#131315] border border-gray-800 p-2 rounded-lg flex gap-2 min-h-[15vh] max-h-40 w-full">
      
      {/* Poster */}
      <div className="relative h-full aspect-2/3 rounded-lg overflow-hidden shrink-0">
        <Image
          src={posterUrl}
          alt={media.title}
          fill
          className="object-contain"
          sizes="120px"
        />
      </div>

      {/* Infos */}
      <div className="flex flex-col justify-between min-w-0 flex-1 py-1">
        
        <div>
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">
            {media.title}
          </h3>

          <p className="text-xs text-gray-400 mt-1">
            {mainGenre}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Star size={14} className="fill-orange-500 stroke-none" />
            <span className="text-white font-medium">
              {media.vote_average && media.vote_count > 0
                ? media.vote_average.toFixed(1)
                : "N/A"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-gray-400">
            <Users size={13} />
            <span>{media.vote_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaSmallCard;
