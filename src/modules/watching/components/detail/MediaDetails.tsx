"use client";

import { ExternalLink, Trophy } from "lucide-react";
import { useImdbId } from "../../hooks/useImdbId";
import { useOmdbRatings } from "../../hooks/useOmdbRatings";
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

// OMDb awards come as one string ("Won 2 Oscars. 163 wins & 165 nominations total").
// Split it into a bold headline + tabular counts so it reads as a highlight, not prose.
function parseAwards(raw: string) {
  const wins = raw.match(/(\d+)\s+wins?/i)?.[1] ?? null;
  const noms = raw.match(/(\d+)\s+nomination/i)?.[1] ?? null;
  const headline = raw.match(/^\s*(Won|Nominated for)[^.]*/i)?.[0]?.trim() ?? null;
  return { headline, wins, noms, raw };
}

function AwardsBlock({ raw }: { raw: string }) {
  const { headline, wins, noms } = parseAwards(raw);
  const counts = [
    wins && `${wins} win${wins === "1" ? "" : "s"}`,
    noms && `${noms} nomination${noms === "1" ? "" : "s"}`,
  ].filter(Boolean).join(" · ");
  const title = headline ?? (wins ? "Award-winning" : noms ? "Award-nominated" : raw);

  return (
    <div className="flex items-start gap-2.5 border-b border-border-subtle px-4 py-3">
      <Trophy size={15} className="mt-0.5 shrink-0 text-amber-400" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {counts && <p className="mt-0.5 text-xs tabular-nums text-text-tertiary">{counts}</p>}
      </div>
    </div>
  );
}

interface Props {
  media: WatchingMedia;
  typeLabel: string;
  isSeries: boolean;
}

// Pure catalog reference. YOUR data (watched year, rewatches, status) lives in
// the StatusCard — one home per fact, never two. Ratings live in the hero;
// this card holds the reference facts + awards + box office.
export function MediaDetails({ media, typeLabel, isSeries }: Props) {
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: omdb } = useOmdbRatings(imdbId, !!imdbId);
  const { data: ageRating } = useAgeRating(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);

  const isFilm = media.type === "film";

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
            className="inline-flex items-center gap-1 rounded-md bg-[#F5C518] px-2 py-1 text-[11px] font-bold text-black transition-opacity hover:opacity-85"
          >
            IMDb
            <ExternalLink size={10} strokeWidth={2.5} />
          </a>
        )}
      </div>
      <div className="surface-quiet overflow-hidden rounded-card">
        {omdb?.awards && <AwardsBlock raw={omdb.awards} />}
        {/* Reference only — year/runtime/seasons/status live in the hero, never twice. */}
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
          {isSeries && media.episodes ? <DetailRow label="Episodes" value={media.episodes} /> : null}
          {isSeries
            ? (omdb?.yearRange ? <DetailRow label="Aired" value={omdb.yearRange} /> : null)
            : (omdb?.released ? <DetailRow label="Released" value={omdb.released} /> : null)}
          {omdb?.country ? <DetailRow label="Country" value={omdb.country} /> : null}
          {omdb?.language ? <DetailRow label="Language" value={omdb.language} /> : null}
          {media.studio ? <DetailRow label="Studio" value={media.studio} /> : null}
          {isFilm && omdb?.boxOffice ? <DetailRow label="Box office" value={omdb.boxOffice} /> : null}
          {omdb?.imdbVotes ? <DetailRow label="IMDb votes" value={omdb.imdbVotes} /> : null}
        </div>
      </div>
    </section>
  );
}
