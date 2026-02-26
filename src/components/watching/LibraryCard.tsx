"use client";

import Image from "next/image";
import { Star, Heart } from "lucide-react";
import type { WatchItem } from "@/lib/watching-data";

interface Props {
  item: WatchItem;
  onClick: () => void;
}

export default function LibraryCard({ item, onClick }: Props) {
  return (
    <div className="group relative cursor-pointer overflow-hidden rounded-xl" onClick={onClick}>
      <div className="relative aspect-2/3 overflow-hidden rounded-xl shadow-xl">
        <Image
          src={item.poster_url || "/placeholder.svg"}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
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
              <span className="font-semibold">{item.user_rating}/10</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 px-1">
        <h4 className="font-semibold text-white line-clamp-1">{item.title}</h4>
        <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
          <span>{item.year}</span>
          {item.tags?.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider">
              {item.tags[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
