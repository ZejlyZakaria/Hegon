"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import type { WatchingMedia } from "../../types";
import { displayTitle } from "../../utils";
import { useImdbId } from "../../hooks/useImdbId";
import { useOmdbRatings } from "../../hooks/useOmdbRatings";

// Non-Latin (CJK / Kana / Hangul) original titles add nothing here — 進撃の巨人 / 기생충
// are noise under the English title. Latin-script alternates (French, romaji…) stay.
const NON_LATIN = /[　-ヿ㐀-鿿가-힯豈-﫿＀-￯]/;

// "DEATH NOTE" and "Death Note" are the same title — compare without case/punctuation.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Critical consensus at the decision point, inline in the meta row (no chrome). TMDB is
// always there; IMDb/RT come from OMDb (often absent on anime → degrades, never empty).
// RT falls back to Metacritic so the third slot fills more often.
type HeroScore = { key: string; logo: string; alt: string; value: string };
function useHeroScores(media: WatchingMedia): HeroScore[] {
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: omdb } = useOmdbRatings(imdbId, !!imdbId);
  return [
    media.rating ? { key: "tmdb", logo: "/logo/watching_rating/Tmdb.svg", alt: "TMDB", value: media.rating.toFixed(1) } : null,
    omdb?.imdb ? { key: "imdb", logo: "/logo/watching_rating/Imdb.svg", alt: "IMDb", value: omdb.imdb } : null,
    omdb?.rottenTomatoes
      ? { key: "rt", logo: "/logo/watching_rating/Rotten_Tomatoes.svg", alt: "Rotten Tomatoes", value: omdb.rottenTomatoes }
      : omdb?.metacritic
        ? { key: "mc", logo: "/logo/watching_rating/Metacritic.svg", alt: "Metacritic", value: omdb.metacritic }
        : null,
  ].filter(Boolean) as HeroScore[];
}

// Synopsis clamped to 3 lines on both breakpoints (mobile used to dump the full wall,
// desktop cut it dead). "More" only appears when the text actually overflows the clamp.
function HeroDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // null = not yet measured (render full to measure) · -1 = fits, no toggle · n = collapse at n chars
  const [cut, setCut] = useState<number | null>(null);

  const measure = (el: HTMLParagraphElement | null) => {
    // Ref callback runs at commit (not render) → measuring is lint-safe.
    if (!el || expanded || cut !== null) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const lines = Math.round(el.scrollHeight / lh);
    if (lines <= 3) { setCut(-1); return; }
    // Proportional cut to ~3 lines, trimmed to a word boundary, leaving room for "… More".
    const approx = Math.floor(text.length * (3 / lines) * 0.92);
    const boundary = text.lastIndexOf(" ", approx);
    setCut(boundary > 40 ? boundary : approx);
  };

  const btn = "font-medium text-white/45 transition-colors hover:text-white/80";
  const collapsed = !expanded && cut !== null && cut !== -1;

  return (
    <div className="mt-3 max-w-4xl">
      {/* JS truncation instead of line-clamp: no color mask over the backdrop photo,
          so "More" reads inline as "…More" right after the text on any background. */}
      <p ref={measure} className="text-sm leading-relaxed text-white/60">
        {collapsed ? (
          <>
            {text.slice(0, cut).trimEnd()}
            {"… "}
            <button type="button" onClick={() => setExpanded(true)} className={btn}>More</button>
          </>
        ) : expanded ? (
          <>
            {text}{" "}
            <button type="button" onClick={() => setExpanded(false)} className={btn}>Less</button>
          </>
        ) : (
          text
        )}
      </p>
    </div>
  );
}

interface Props {
  media: WatchingMedia;
  isSeries: boolean;
  onBack: () => void;
  hasTrailer?: boolean;
  trailerLoading?: boolean;
  onPlayTrailer?: () => void;
}

export function MediaHero({ media, isSeries, onBack, hasTrailer, trailerLoading, onPlayTrailer }: Props) {
  const mainTitle = displayTitle(media);
  const other = mainTitle === media.title ? media.original_title : media.title;
  // Same title in a different case (title "Death Note" / original "DEATH NOTE"): keep the
  // nicely-cased one and drop the echo. Done locally — displayTitle is used module-wide.
  const sameTitle = !!other && norm(other) === norm(mainTitle);
  const title = sameTitle ? media.title : mainTitle;
  const showAltTitle = !!other && !sameTitle && !NON_LATIN.test(other);
  const scores = useHeroScores(media);

  // No badges in the hero. The run status is a fact like "4 seasons" → it belongs in the
  // meta row, and only when it changes the decision (series run, film not yet out).
  const showStatus = !!media.status && (isSeries || media.status.toLowerCase() !== "released");

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
      {showStatus && (
        <>
          <span className="text-white/20">·</span>
          <span className="capitalize">{media.status}</span>
        </>
      )}
      {/* Ratings inline in the same row — no pill, just logo + score after the facts */}
      {scores.map((s) => (
        <Fragment key={s.key}>
          <span className="text-white/20">·</span>
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo} alt={s.alt} className="h-3.5 w-auto object-contain" />
            <span className="font-medium tabular-nums text-white/85">{s.value}</span>
          </span>
        </Fragment>
      ))}
    </>
  );

  // Last thing in the hero: after the pitch, the natural next gesture. Secondary on
  // purpose — the StatusCard owns the white primary action.
  // The slot is reserved from the first paint: the TMDB videos call resolves late, and
  // letting the button pop in shoved the whole (bottom-anchored) hero upward. Loading →
  // disabled + spinner; no trailer at all → invisible, but it still holds its row.
  const trailerButton = onPlayTrailer ? (
    <button
      type="button"
      disabled={!hasTrailer}
      onClick={hasTrailer ? onPlayTrailer : undefined}
      className={cn(
        "group mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[13px] font-medium text-white/85 backdrop-blur-sm transition-colors",
        hasTrailer && "hover:border-white/35 hover:bg-white/10 hover:text-white",
        trailerLoading && "cursor-wait opacity-50",
        !hasTrailer && !trailerLoading && "invisible",
      )}
    >
      {trailerLoading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Play size={12} className="fill-current transition-transform group-hover:scale-110" />
      )}
      Watch trailer
    </button>
  ) : null;

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
          <div className="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/30 to-transparent" />
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
            <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-tile border border-white/10 shadow-xl">
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
                {title}
              </h1>
              {showAltTitle && (
                <p className="mt-0.5 truncate text-sm text-white/35">{other}</p>
              )}
            </div>
          </div>

          {/* Title → genres → facts → pitch → the trailer gesture */}
          {media.tags && media.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-white/6 px-2.5 py-0.5 text-xs text-white/40 ring-1 ring-white/6">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
            {metaRow}
          </div>

          {media.description && <HeroDescription text={media.description} />}

          {trailerButton}
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
        <div className="absolute inset-0 bg-linear-to-b from-black/10 via-surface-0/50 to-surface-0" />
        <div className="absolute inset-0 bg-linear-to-r from-surface-0/80 via-surface-0/20 to-transparent" />

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
              <div className="relative aspect-2/3 w-40 overflow-hidden rounded-tile p-1">
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

            {/* Title → genres → facts → pitch → the trailer gesture */}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white">
                {title}
              </h1>
              {showAltTitle && (
                <p className="mt-0.5 truncate text-sm text-white/35">{other}</p>
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

              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
                {metaRow}
              </div>

              {media.description && <HeroDescription text={media.description} />}

              {trailerButton}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
