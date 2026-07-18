"use client";

import { ExternalLink, Trophy } from "lucide-react";
import { Hint } from "@/shared/components/ui/tooltip";
import { Panel } from "@/shared/components/ui/panel";
import { useImdbId } from "../../hooks/useImdbId";
import { useOmdbRatings } from "../../hooks/useOmdbRatings";
import { useAgeRating } from "../../hooks/useAgeRating";
import type { WatchingMedia } from "../../types";

// A certification code is a shorthand only the initiated read — "TV-MA", "R", "-16" say nothing to
// most people. The badge stays (it's compact and recognisable), and hovering it spells out the rule.
const AGE_RATING_HINT: Record<string, string> = {
  // US — film (MPAA)
  "G": "General audiences — all ages admitted",
  "PG": "Parental guidance suggested",
  "PG-13": "Some material may be unsuitable for children under 13",
  "R": "Restricted — under 17 requires an accompanying adult",
  "NC-17": "Adults only — no one 17 and under admitted",
  // US — TV
  "TV-Y": "Suitable for all children",
  "TV-Y7": "Suitable for children 7 and older",
  "TV-G": "Suitable for all ages",
  "TV-PG": "Parental guidance suggested",
  "TV-14": "Unsuitable for children under 14",
  "TV-MA": "Mature audiences — 17 and older",
  // UK — BBFC
  "U": "Suitable for all ages",
  "12": "Suitable for 12 and older",
  "12A": "Under 12 must be accompanied by an adult",
  "15": "Suitable for 15 and older",
  "18": "Suitable for adults only",
  // FR — CNC
  "-10": "Not recommended for under 10",
  "-12": "Prohibited for under 12",
  "-16": "Prohibited for under 16",
  "-18": "Prohibited for under 18",
  "Tous publics": "Suitable for all audiences",
};

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
    <div className="flex items-start gap-2.5 border-b border-border-subtle px-4 py-3 sm:px-5">
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
    <Panel
      title="Details"
      bleed
      actions={
        imdbId ? (
          <Hint label="View on IMDb">
            <a
              href={`https://www.imdb.com/title/${imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-chip bg-[#F5C518] px-2 py-1 text-micro font-bold text-black transition-opacity hover:opacity-85"
            >
              IMDb
              <ExternalLink size={10} strokeWidth={2.5} />
            </a>
          </Hint>
        ) : null
      }
    >
      <div className="overflow-hidden">
        {omdb?.awards && <AwardsBlock raw={omdb.awards} />}
        {/* Reference only — year/runtime/seasons/status live in the hero, never twice. */}
        <div className="divide-y divide-border-subtle px-4 sm:px-5">
          <DetailRow label="Type" value={typeLabel} />
          {ageRating ? (
            <DetailRow
              label="Age rating"
              value={(() => {
                const badge = (
                  <span
                    className={`inline-flex items-center rounded border border-border-default px-1.5 py-0.5 text-micro font-semibold text-text-primary ${AGE_RATING_HINT[ageRating] ? "cursor-help" : ""}`}
                  >
                    {ageRating}
                  </span>
                );
                return AGE_RATING_HINT[ageRating]
                  ? <Hint label={AGE_RATING_HINT[ageRating]}>{badge}</Hint>
                  : badge;
              })()}
            />
          ) : null}
          {isSeries && media.episodes ? <DetailRow label="Episodes" value={media.episodes} /> : null}
          {isSeries
            ? (omdb?.yearRange ? <DetailRow label="Aired" value={omdb.yearRange} /> : null)
            // Films: one source of truth for the date — our stored TMDB `release_date`, the same value
            // the "Waiting for" rail reads. OMDb no longer supplies it (it kept giving a DIFFERENT day
            // than the rail). OMDb still complements with ratings, awards and box office below.
            : (media.release_date
                ? <DetailRow label="Released" value={new Date(media.release_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
                : null)}
          {omdb?.country ? <DetailRow label="Country" value={omdb.country} /> : null}
          {omdb?.language ? <DetailRow label="Language" value={omdb.language} /> : null}
          {media.studio ? <DetailRow label="Studio" value={media.studio} /> : null}
          {isFilm && omdb?.boxOffice ? <DetailRow label="Box office" value={omdb.boxOffice} /> : null}
          {omdb?.imdbVotes ? <DetailRow label="IMDb votes" value={omdb.imdbVotes} /> : null}
        </div>
      </div>
    </Panel>
  );
}
