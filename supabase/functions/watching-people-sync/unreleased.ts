// THE TITLES YOU OWN THAT ARE NOT OUT YET — refreshed from TMDB once a week (owner, 2026-09-17).
//
// An add COPIES the world into media_items: poster, backdrop, title, release date, cast. For a
// released title that copy is final enough. For a film added a year before its release it is a
// snapshot of a placeholder: "Untitled Daniels Event Film", no poster, a provisional date, half a
// cast. Nothing came back for it — series-sync refreshes seasons, not this — so the Waiting for
// rail kept its grey rectangle even after the trailer, even after the premiere.
//
// Which rows: films whose release_date is ahead, missing, or less than 30 days behind (the poster
// often changes right around release); series and anime with nothing aired yet (season_aired all
// zero or null). What moves: poster (unless the owner uploaded his own — a non-TMDB URL is never
// touched), backdrop, release date and year, the cast and crew, and the title ONLY while the stored
// one is a placeholder ("Untitled …") — a title the owner may have edited is his.
// deno-lint-ignore-file no-explicit-any
import { errMsg } from "../_shared/retry.ts";

const TMDB = "https://api.themoviedb.org/3";
const KEY = Deno.env.get("TMDB_API_KEY")!;
const IMG = "https://image.tmdb.org/t/p";
const RECENT_DAYS = 30;
const BATCH = 200;
const PLACEHOLDER = /^untitled\b/i;

async function tmdb(path: string, isFilm: boolean, fetchImpl: typeof fetch) {
  // TV keeps its recurring cast in aggregate_credits; a film has only credits.
  const append = isFilm ? "credits" : "credits,aggregate_credits";
  const res = await fetchImpl(`${TMDB}/${path}?api_key=${KEY}&language=en-US&append_to_response=${append}`);
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return res.json();
}

const isTmdbUrl = (u: string | null) => !u || u.startsWith(IMG);

function credits(d: any, isFilm: boolean) {
  const rawCast: any[] = isFilm ? d.credits?.cast ?? [] : d.aggregate_credits?.cast?.length ? d.aggregate_credits.cast : d.credits?.cast ?? [];
  const cast = rawCast.map((p) => ({
    id: p.id, name: p.name,
    character: p.character || p.roles?.[0]?.character || null,
    profile_url: p.profile_path ? `${IMG}/w185${p.profile_path}` : null,
  }));
  const jobs = isFilm ? ["Director"] : ["Creator", "Series Director", "Executive Producer"];
  const seen = new Set<number>();
  const directors = (d.credits?.crew ?? [])
    .filter((p: any) => jobs.includes(p.job) && !seen.has(p.id) && seen.add(p.id))
    .slice(0, 3)
    .map((p: any) => ({ id: p.id, name: p.name, profile_url: p.profile_path ? `${IMG}/w185${p.profile_path}` : null }));
  return { cast, directors };
}

/** Refresh every owned title that is not out yet. Returns what it touched. */
export async function refreshUnreleased(supabase: any, fetchImpl: typeof fetch): Promise<{ scanned: number; updated: number; failed: number }> {
  const floor = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const cols = "id, type, tmdb_id, title, poster_url, release_date, season_aired";
  // Films: ahead or just out — or undated AND still only wanted (legacy watched rows have no date
  // either, and they are not waiting for anything). Series: nothing aired yet (the aired array).
  const [films, shows] = await Promise.all([
    supabase.from("media_items").select(cols).eq("type", "film").or(`release_date.gte.${floor},and(release_date.is.null,want_to_watch.eq.true,watched.eq.false,in_progress.eq.false)`).not("tmdb_id", "is", null).limit(BATCH),
    supabase.from("media_items").select(cols).in("type", ["serie", "anime"]).not("tmdb_id", "is", null).limit(1000),
  ]);
  if (films.error) throw films.error;
  if (shows.error) throw shows.error;
  const unaired = (shows.data ?? []).filter((r: any) => !Array.isArray(r.season_aired) || r.season_aired.every((n: number) => !n)).slice(0, BATCH);
  const rows: any[] = [...(films.data ?? []), ...unaired];

  let updated = 0, failed = 0;
  // One TMDB call per title, grouped by tmdb id so ten users owning one film cost one call.
  const byTmdb = new Map<string, any[]>();
  for (const r of rows) { const k = `${r.type === "film" ? "movie" : "tv"}:${r.tmdb_id}`; byTmdb.set(k, [...(byTmdb.get(k) ?? []), r]); }
  for (const [key, group] of byTmdb) {
    const [kind, id] = key.split(":");
    const isFilm = kind === "movie";
    try {
      const d = await tmdb(`${kind}/${id}`, isFilm, fetchImpl);
      const date: string | null = (isFilm ? d.release_date : d.first_air_date) || null;
      const { cast, directors } = credits(d, isFilm);
      for (const r of group) {
        const patch: Record<string, unknown> = {
          backdrop_url: d.backdrop_path ? `${IMG}/original${d.backdrop_path}` : null,
          year: date ? Number(date.slice(0, 4)) : 0,
          cast_members: cast,
          directors: directors.length ? directors : null,
        };
        if (isFilm) patch.release_date = date;
        if (isTmdbUrl(r.poster_url)) patch.poster_url = d.poster_path ? `${IMG}/w500${d.poster_path}` : null;
        if (PLACEHOLDER.test(r.title ?? "") && (d.title || d.name)) patch.title = d.title ?? d.name;
        const { error } = await supabase.from("media_items").update(patch).eq("id", r.id);
        if (error) throw error;
        updated++;
      }
    } catch (e) {
      console.error(`unreleased ${key}: ${errMsg(e)}`);
      failed += group.length;
    }
  }
  return { scanned: rows.length, updated, failed };
}
