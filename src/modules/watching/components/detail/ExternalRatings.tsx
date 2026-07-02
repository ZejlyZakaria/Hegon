"use client";

import { Award } from "lucide-react";
import { useImdbId } from "../../hooks/useImdbId";
import { useOmdbRatings } from "../../hooks/useOmdbRatings";
import type { WatchingMedia } from "../../types";

function RatingCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-text-primary">{value}</p>
    </div>
  );
}

export function ExternalRatings({ media }: { media: WatchingMedia }) {
  const { data: imdbId } = useImdbId(media.tmdb_id ?? 0, media.type, !!media.tmdb_id);
  const { data: omdb } = useOmdbRatings(imdbId, !!imdbId);

  if (!omdb) return null;
  const cells = [
    omdb.imdb ? { label: "IMDb", value: omdb.imdb } : null,
    omdb.rottenTomatoes ? { label: "Rotten Tomatoes", value: omdb.rottenTomatoes } : null,
    omdb.metacritic ? { label: "Metacritic", value: omdb.metacritic } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const isFilm = media.type === "film";
  if (cells.length === 0 && !omdb.awards && !(isFilm && omdb.boxOffice)) return null;

  return (
    <div>
      <h2 className="mb-3 text-title text-text-primary">Ratings</h2>

      {cells.length > 0 && (
        <div className="flex divide-x divide-border-subtle overflow-hidden rounded-2xl surface-quiet">
          {cells.map((c) => (
            <RatingCell key={c.label} label={c.label} value={c.value} />
          ))}
        </div>
      )}

      {omdb.awards && (
        <div className="mt-3 flex items-start gap-2">
          <Award size={13} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-text-secondary">{omdb.awards}</p>
        </div>
      )}

      {isFilm && omdb.boxOffice && (
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-xs text-text-tertiary">Box office</span>
          <span className="text-xs font-medium text-text-secondary">{omdb.boxOffice}</span>
        </div>
      )}
    </div>
  );
}
