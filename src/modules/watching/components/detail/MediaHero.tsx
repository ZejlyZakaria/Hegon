"use client";

import Image from "next/image";
import { ArrowLeft, Star } from "lucide-react";
import type { WatchingMedia } from "../../types";
import { displayTitle } from "../../utils";

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
  onBack: () => void;
}

export function MediaHero({ media, typeLabel, isSeries, onBack }: Props) {
  const tmdbRating = media.rating ?? 0;
  const mainTitle = displayTitle(media);
  const altTitle = mainTitle === media.title ? media.original_title : media.title;

  const metaRow = (
    <>
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
    </>
  );

  return (
    <>
      {/* ── Mobile: stacked cinematic hero (backdrop → poster overlap → full-width info) ── */}
      <div className="lg:hidden">
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={media.backdrop_url || media.poster_url || "/placeholder.svg"}
            alt=""
            fill
            priority
            unoptimized
            className="object-cover"
            style={{ objectPosition: "center 25%" }}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/80 backdrop-blur-sm"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        </div>

        <div className="relative -mt-16 px-4 pb-2">
          {/* poster + title side by side (title fills the space, not the badges) */}
          <div className="flex items-end gap-4">
            <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-xl">
              <Image
                src={media.poster_url || "/placeholder.svg"}
                alt={media.title}
                fill
                unoptimized
                priority
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-balance text-xl font-bold leading-tight tracking-tight text-white line-clamp-3">
                {mainTitle}
              </h1>
              {altTitle && altTitle !== mainTitle && (
                <p className="mt-0.5 truncate text-sm text-white/35">{altTitle}</p>
              )}
            </div>
          </div>

          {/* badges + meta — full width below the poster row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-accent-watching px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
              {typeLabel}
            </span>
            {media.status && (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] font-medium capitalize text-white/70 backdrop-blur-md">
                {media.status}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
            {metaRow}
          </div>

          {media.tags && media.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-white/6 px-2.5 py-0.5 text-xs text-white/40 ring-1 ring-white/6">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {media.description && (
            <p className="mt-3 text-sm leading-relaxed text-white/60">{media.description}</p>
          )}
        </div>
      </div>

      {/* ── Desktop: wide cinematic banner ── */}
      <div className="relative hidden w-full overflow-hidden lg:block" style={{ aspectRatio: "21/9", maxHeight: "55vh", minHeight: 280 }}>
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
          className="group absolute left-10 top-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 text-[13px] font-medium text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/50 hover:text-white"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-10 pb-8">
          <div className="flex items-end gap-8">
            {/* Poster */}
            <div className="relative shrink-0">
              <div className="relative aspect-2/3 w-40 overflow-hidden rounded-xl p-1">
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

              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white">
                {mainTitle}
              </h1>
              {altTitle && altTitle !== mainTitle && (
                <p className="mt-0.5 truncate text-sm text-white/35">{altTitle}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
                {metaRow}
              </div>

              {media.description && (
                <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/60">
                  {media.description}
                </p>
              )}

              {media.tags && media.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {media.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/6 px-2.5 py-0.5 text-xs text-white/40 ring-1 ring-white/6">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
