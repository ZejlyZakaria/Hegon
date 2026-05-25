"use client";

import Image from "next/image";
import { ArrowLeft, Star } from "lucide-react";
import type { WatchingMedia } from "../../types";

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
  onBack: () => void;
}

export function MediaHero({ media, typeLabel, isSeries, onBack }: Props) {
  const tmdbRating = media.rating ?? 0;

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
      <Image
        src={media.backdrop_url || media.poster_url || "/placeholder.svg"}
        alt=""
        fill
        priority
        unoptimized
        className="object-cover"
        style={{ objectPosition: "center 27%" }}
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/10 via-zinc-950/50 to-zinc-950" />
      <div className="absolute inset-0 bg-linear-to-r from-zinc-950/80 via-zinc-950/20 to-transparent" />

      <button
        type="button"
        onClick={onBack}
        className="group absolute left-6 top-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 text-[13px] font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-black/50 hover:text-white md:left-10"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
        Back
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 md:px-10">
        <div className="flex items-end gap-6 md:gap-8">

          {/* Poster */}
          <div className="relative shrink-0">
            <div className="relative aspect-2/3 w-32 overflow-hidden rounded-xl p-1 md:w-40">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${media.poster_url || "/placeholder.svg"})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(6px) saturate(180%) brightness(1.2)",
                }}
              />
              <div className="absolute inset-0 bg-white/15" />
              <div className="relative h-full w-full overflow-hidden rounded-[10px]">
                <Image
                  src={media.poster_url || "/placeholder.svg"}
                  alt={media.title}
                  fill
                  unoptimized
                  priority
                  sizes="160px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Title + meta */}
          <div className="min-w-0 flex-1 pb-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent-watching px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                {typeLabel}
              </span>
              {media.status && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs font-medium capitalize text-white/70 backdrop-blur-md">
                  {media.status}
                </span>
              )}
            </div>

            <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              {media.title}
            </h1>
            {media.original_title && media.original_title !== media.title && (
              <p className="mt-0.5 truncate text-sm text-white/35">{media.original_title}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
              {media.year && <span>{media.year}</span>}
              {media.runtime && (
                <>
                  <span className="text-white/20">·</span>
                  <span>{media.type === "film" ? `${media.runtime} min` : `~${media.runtime} min/ep`}</span>
                </>
              )}
              {isSeries && media.seasons && (
                <>
                  <span className="text-white/20">·</span>
                  <span>{media.seasons} season{media.seasons > 1 ? "s" : ""}</span>
                </>
              )}
              {tmdbRating > 0 && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="flex items-center gap-1">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    {tmdbRating.toFixed(1)}
                  </span>
                </>
              )}
            </div>

            {media.description && (
              <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/60">
                {media.description}
              </p>
            )}

            {media.tags && media.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {media.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/6 px-2.5 py-0.5 text-xs text-white/40 ring-1 ring-white/6"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
