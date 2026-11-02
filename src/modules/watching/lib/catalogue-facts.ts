import type { AnimeCoursRow } from "../types";

export function catalogueEpisodes(media: { season_aired?: number[] | null; season_episodes?: number[] | null; episodes?: number | null }) {
  const sum = (values: number[] | null | undefined) => values?.length && values.every(n => Number.isInteger(n) && n >= 0) ? values.reduce((a, b) => a + b, 0) : null;
  const aired = sum(media.season_aired);
  const announced = sum(media.season_episodes);
  const fallback = media.episodes != null && Number.isInteger(media.episodes) && media.episodes > 0 ? media.episodes : null;
  return { aired, total: announced != null && announced > 0 ? Math.max(announced, aired ?? 0) : fallback == null ? aired : Math.max(fallback, aired ?? 0) };
}
export function catalogueReleaseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m)-1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m)-1 || date.getUTCDate() !== Number(d)) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
export const catalogueText = (value: string | null | undefined) => value?.trim() && value.trim() !== "N/A" ? value.trim() : null;

/** Stored season air dates cover the whole work, unlike an IMDb entry for only its original run. */
export function catalogueBroadcastYears(media: {year?:number|null; status?:string|null;season_air_dates?:(string|null)[]|null;season_end_dates?:(string|null)[]|null;season_aired?:number[]|null}, fallback?:string|null): string|null {
  const yearOf = (d:string|null) => catalogueReleaseDate(d) ? Number(d!.slice(0,4)) : null;
  const starts = (media.season_air_dates ?? []).flatMap((d,i) => (media.season_aired?.[i] ?? 0)>0 && yearOf(d)!=null ? [yearOf(d)!] : []);
  const ends = (media.season_end_dates ?? []).flatMap((d,i) => (media.season_aired?.[i] ?? 0)>0 && yearOf(d)!=null ? [yearOf(d)!] : []);
  const start = starts.length ? Math.min(...starts) : null;
  if (start == null) return catalogueText(fallback);
  const ended = ["ended","canceled","cancelled"].includes((media.status ?? "").toLowerCase());
  const returning = ["ongoing","returning series","in production"].includes((media.status ?? "").toLowerCase());
  if (!ended && returning) return `${start}\u2013present`;
  if (ends.length) {
    const last = Math.max(start,...starts,...ends);
    return start === last ? String(start) : `${start}\u2013${last}`;
  }
  // A season premiere proves a start, not the final broadcast year.
  return catalogueText(fallback) ?? String(start);
}


/** Credits retain AniList entry titles; never project a broadcaster or guess a TMDB season. */
export function animationStudioCredits(row: AnimeCoursRow | null | undefined) {
  if (row?.source !== "anilist") return [];
  const credits = row.cours.flatMap(c => {
    const names = [...new Set((c.studios ?? []).map(s=>catalogueText(s.name)).filter((n):n is string=>!!n))];
    return names.length ? [{title:c.title,names}] : [];
  });
  if (!credits.length) return [];
  const same = credits.length === row.cours.length && credits.every(c=>[...c.names].sort().join("\0") === [...credits[0].names].sort().join("\0"));
  return same ? [{title:null,names:credits[0].names}] : credits;
}
