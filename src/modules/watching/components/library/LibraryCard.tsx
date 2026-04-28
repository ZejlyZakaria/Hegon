"use client";

import Image from "next/image";
import { Star, Heart } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";

interface Props {
  item: WatchingMedia;
  onClick: () => void;
}

export default function LibraryCard({ item, onClick }: Props) {
  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg"
      onClick={onClick}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg">
        <Image
          src={item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          quality={75}
        />

        {/* Favorite heart */}
        {item.favorite && (
          <div className="absolute top-3 right-3">
            <Heart
              size={18}
              className="fill-red-500 text-red-500 drop-shadow"
            />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
          {item.user_rating && (
            <div className="flex items-center gap-1.5 text-white">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">{item.user_rating}/10</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 px-1">
        <h4 className="font-semibold text-text-primary text-sm line-clamp-1">{item.title}</h4>
        <div className="mt-1 flex items-center justify-between text-xs text-text-tertiary">
          <span className="mr-2">{item.year}</span>
          {item.tags?.length > 0 && (
            <span className="text-[9px] uppercase tracking-wider line-clamp-1">
              {item.tags[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
