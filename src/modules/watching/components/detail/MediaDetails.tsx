"use client";

import { ExternalLink, Pencil } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { useImdbId } from "../../hooks/useImdbId";
import { useAgeRating } from "../../hooks/useAgeRating";
import type { WatchingMedia } from "../../types";

// "Watched" label: a year range for series/anime (from the per-season years you
// filled in Watch History), a single year for films, and "Since {year}" while a
// show is still in progress.
function watchedLabel(media: WatchingMedia): string | null {
  if (media.type === "film") {
    return media.watched && media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  }
  const years = Object.values(media.season_years ?? {}).map(Number).filter((y) => !Number.isNaN(y));
  if (media.in_progress) {
    return years.length ? `Since ${Math.min(...years)}` : "Watching";
  }
  if (!media.watched) return null;
  if (!years.length) return media.watched_at ? String(new Date(media.watched_at).getFullYear()) : null;
  const min = Math.min(...years), max = Math.max(...years);
  return min === max ? String(min) : `${min} – ${max}`;
}

// The single year currently attributed to the title (films → watched_at year;
// single-season shows → the season-1 stamp). Drives the editor's selected value.
function watchedYearOf(media: WatchingMedia): number | null {
  if (media.type === "film") return media.watched_at ? new Date(media.watched_at).getFullYear() : null;
  return media.season_years?.["1"] ?? null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-xs font-medium text-text-secondary">{value}</span>
    </div>
  );
}

// Editable "Watched" row — for titles with no Watch History strip (films + single
// -season series/anime), a click opens a year picker that writes the real watch
// year (so Stats attributes it correctly instead of falling back to updated_at).
function WatchedYearRow({
  media,
  onWatchedYearChange,
}: {
  media: WatchingMedia;
  onWatchedYearChange: (year: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const label = watchedLabel(media);
  const selected = watchedYearOf(media);

  const floor = media.year ?? 1950;
  const years: number[] = [];
  for (let y = currentYear; y >= Math.min(floor, currentYear); y--) years.push(y);

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">Watched</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group inline-flex items-center gap-1.5 text-right text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {label ?? "Set year"}
            <Pencil size={10} className="text-text-tertiary transition-colors group-hover:text-text-secondary" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 border-border-strong bg-surface-3 p-3">
          <label className="mb-1 block text-[11px] text-text-tertiary">
            {media.type === "film" ? "Year watched" : "Year started"}
          </label>
          <Select value={selected ? String(selected) : undefined} onValueChange={(v) => onWatchedYearChange(Number(v))}>
            <SelectTrigger className="h-8 w-full border-border-subtle bg-surface-1 text-xs text-text-primary focus:ring-0">
              <SelectValue placeholder="Pick a year" />
            </SelectTrigger>
            <SelectContent className="border-border-strong bg-surface-3">
              {years.map((yr) => (
                <SelectItem key={yr} value={String(yr)} className="text-xs focus:bg-surface-2 focus:text-text-primary">{yr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
  onWatchedYearChange?: (year: number) => void;
}

export function MediaDetails({ media, typeLabel, isSeries, onWatchedYearChange }: Props) {
  const label = watchedLabel(media);
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: ageRating } = useAgeRating(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);

  // The "Watched" row is editable only where there's no Watch History strip:
  // films (once watched) and single-season series/anime (watched or in progress).
  // Multi-season shows keep the read-only range — their years live in the strip.
  const seasonCount = media.season_episodes?.length ?? 0;
  const editableWatched =
    !!onWatchedYearChange &&
    (media.type === "film"
      ? media.watched
      : (media.watched || media.in_progress) && seasonCount <= 1);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-title text-text-primary">Details</h2>
        {imdbId && (
          <a
            href={`https://www.imdb.com/title/${imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            title="View on IMDb"
            className="inline-flex items-center gap-1 rounded-md bg-[#F5C518] px-2 py-1 text-[11px] font-bold text-black transition-transform duration-150 ease-out hover:scale-105"
          >
            IMDb
            <ExternalLink size={10} strokeWidth={2.5} />
          </a>
        )}
      </div>
      <div className="surface-quiet overflow-hidden rounded-2xl">
        <div className="divide-y divide-border-subtle px-4">
          <DetailRow label="Type" value={typeLabel} />
          {ageRating ? (
            <DetailRow
              label="Age rating"
              value={
                <span className="inline-flex items-center rounded border border-border-default px-1.5 py-0.5 text-[11px] font-semibold text-text-primary">
                  {ageRating}
                </span>
              }
            />
          ) : null}
          {media.year ? <DetailRow label="Year" value={media.year} /> : null}
          {media.runtime ? (
            <DetailRow
              label="Runtime"
              value={media.type === "film" ? `${media.runtime} min` : `~${media.runtime} min/ep`}
            />
          ) : null}
          {isSeries && media.seasons ? <DetailRow label="Seasons" value={media.seasons} /> : null}
          {isSeries && media.episodes ? <DetailRow label="Episodes" value={media.episodes} /> : null}
          {editableWatched ? (
            <WatchedYearRow media={media} onWatchedYearChange={onWatchedYearChange!} />
          ) : label ? (
            <DetailRow label="Watched" value={label} />
          ) : null}
          {media.status ? (
            <DetailRow label="Status" value={<span className="capitalize">{media.status}</span>} />
          ) : null}
          {media.studio ? <DetailRow label="Studio" value={media.studio} /> : null}
        </div>
      </div>
    </section>
  );
}
