"use client";

import { ExternalLink } from "lucide-react";
import { useImdbId } from "../../hooks/useImdbId";
import { useAgeRating } from "../../hooks/useAgeRating";
import type { WatchingMedia } from "../../types";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className="text-right text-xs font-medium text-text-secondary">{value}</span>
    </div>
  );
}

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
}

// Pure catalog reference. YOUR data (watched year, rewatches, status) lives in
// the StatusCard — one home per fact, never two.
export function MediaDetails({ media, typeLabel, isSeries }: Props) {
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: ageRating } = useAgeRating(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);

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
          {media.status ? (
            <DetailRow label="Status" value={<span className="capitalize">{media.status}</span>} />
          ) : null}
          {media.studio ? <DetailRow label="Studio" value={media.studio} /> : null}
        </div>
      </div>
    </section>
  );
}
