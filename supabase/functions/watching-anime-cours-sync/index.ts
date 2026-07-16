// ANIME V2 — the AniList season overlay, kept fresh.
//
// `anime_cours` is a photograph of the day it was resolved. Seasons are announced, they air, and new
// ones appear: the day Jujutsu S4 drops, TMDB's episode count grows (the series-sync does that) but
// the overlay still describes three seasons summing to 59. Nothing here breaks — the mismatch guard
// sees 59 ≠ 71 and the app silently falls back to TMDB's flat structure — but the real seasons stay
// missing until something re-resolves them. This is that something.
//
// ── SAME SHAPE AS watching-series-sync, AND FOR THE SAME REASONS ──────────────────────────────
// · Batches. A full pass is ~70 AniList calls plus a multi-MB mapping fetch; a run that dies takes a
//   batch with it, not the job, and the cron brings it back.
// · Counts SHOWS, not rows. The breakdown of Jujutsu Kaisen is the same for everyone — anime_cours is
//   keyed by tmdb_id, so one fetch serves every owner.
// · Not everything deserves the same attention. A finished anime's seasons are settled; only the ones
//   still running can grow a cour. Finished → weekly. Ongoing → a couple of times a day.
// · Drives from media_items, so an anime nobody owns any more is never re-fetched, and a newly added
//   one (no row yet = infinitely stale) is resolved on the very next run.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRIBB = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const ANILIST = "https://graphql.anilist.co";

/** SHOWS per invocation. AniList is politely rate-limited; this fits well inside the wall clock. */
const BATCH = 20;

const ONGOING_STALE_MS = 12 * 60 * 60 * 1000;       // still running → a cour can appear
const FINISHED_STALE_MS = 7 * 24 * 60 * 60 * 1000;  // over → weekly, for revivals/new arcs

const FINISHED = new Set(["ended", "canceled", "cancelled"]);
const isFinished = (s: unknown) => FINISHED.has(String(s ?? "").toLowerCase());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dateKey = (d: any) => (d?.year ?? 9999) * 10000 + (d?.month ?? 99) * 100 + (d?.day ?? 99);

/** Thrown when AniList asks us to back off. We do — by ending the run, not by sleeping through it:
 *  a 60-second wait inside an edge function spends the budget the batch needed. The cron returns. */
class RateLimited extends Error {}

const QUERY =
  `query($ids:[Int]){ Page(perPage:50){ media(id_in:$ids, type:ANIME){ id episodes ` +
  `startDate{year month day} endDate{year} title{romaji english} coverImage{extraLarge large} } } }`;

async function anilistByIds(ids: number[]): Promise<any[]> {
  const res = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { ids } }),
  });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  return (await res.json()).data?.Page?.media ?? [];
}

/** Order by air date, cumulative-sum the episodes → each cour's TMDB flat-episode range. */
function buildCours(media: any[]) {
  media.sort((a, b) => dateKey(a.startDate) - dateKey(b.startDate));
  const cours: any[] = [];
  let cursor = 0;
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const eps = m.episodes ?? null;
    const start = cursor + 1;
    const end = eps ? cursor + eps : null;
    if (eps) cursor += eps;
    cours.push({
      season: i + 1,
      anilist_id: m.id,
      title: m.title.english || m.title.romaji,
      poster_url: m.coverImage?.extraLarge || m.coverImage?.large || null,
      year: m.startDate?.year ?? null,
      // The year a cour FINISHED airing — floors "year watched". A cour that ran Oct→Mar could not
      // have been finished the year before, and dating it there was the bug this column fixes.
      end_year: m.endDate?.year ?? null,
      episodes: eps,
      start_episode: start,
      end_episode: end,
    });
  }
  return cours;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("HEGON_SECRET_KEY")!,
    { db: { schema: "watching" } },
  );

  try {
    // ── The candidates: every anime SOMEBODY owns. Driving from media_items means an anime that has
    //    been deleted everywhere simply stops being asked about, with no GC job to write.
    const { data: rows, error: rowsErr } = await supabase
      .from("media_items")
      .select("tmdb_id,title,status,episodes")
      .eq("type", "anime")
      .eq("is_reference", false)
      .not("tmdb_id", "is", null);
    if (rowsErr) throw rowsErr;

    const shows = new Map<number, { title: string; status: string | null; episodes: number | null }>();
    for (const r of rows ?? []) {
      if (!shows.has(r.tmdb_id)) shows.set(r.tmdb_id, { title: r.title, status: r.status, episodes: r.episodes });
    }

    const { data: existing, error: exErr } = await supabase
      .from("anime_cours").select("tmdb_id,resolved_at");
    if (exErr) throw exErr;
    const resolvedAt = new Map<number, number>();
    for (const c of existing ?? []) {
      resolvedAt.set(c.tmdb_id, c.resolved_at ? new Date(c.resolved_at).getTime() : 0);
    }

    // Stalest first; never resolved = infinitely stale, so a newly added anime is picked immediately.
    const batch = [...shows.entries()]
      .map(([tmdbId, info]) => {
        const age = Date.now() - (resolvedAt.get(tmdbId) ?? 0);
        const maxAge = isFinished(info.status) ? FINISHED_STALE_MS : ONGOING_STALE_MS;
        return { tmdbId, info, age, due: age >= maxAge };
      })
      .filter((c) => c.due)
      .sort((a, b) => b.age - a.age)
      .slice(0, BATCH);

    if (batch.length === 0) {
      return new Response(JSON.stringify({ ok: true, shows: 0, note: "nothing stale" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── The mapping (tmdb_id → AniList ids). Fetched once per run, and it is what DISCOVERS a new
    //    season: a new cour is a new AniList id we have never seen.
    const fribb: any[] = await (await fetch(FRIBB)).json();
    const idsFor = (tmdbId: number) => {
      const out = new Set<number>();
      for (const e of fribb) {
        if (e.type === "TV" && e.themoviedb_id && e.themoviedb_id.tv === tmdbId && e.anilist_id) out.add(e.anilist_id);
      }
      return [...out];
    };

    let resolved = 0, mismatch = 0, none = 0, failed = 0, rateLimited = false;
    const log: string[] = [];

    for (const { tmdbId, info } of batch) {
      const ids = idsFor(tmdbId);
      const stamp = new Date().toISOString();

      if (ids.length === 0) {
        none++;
        await supabase.from("anime_cours").upsert({ tmdb_id: tmdbId, cours: [], source: "none", resolved_at: stamp });
        continue;
      }

      let media: any[];
      try {
        media = await anilistByIds(ids);
      } catch (e) {
        if (e instanceof RateLimited) { rateLimited = true; log.push("· AniList rate-limited — stopping, the cron will resume"); break; }
        failed++; log.push(`✗ ${info.title}: ${String(e)}`);
        continue;
      }
      await sleep(700);   // AniList is polite, not infinite

      const cours = buildCours(media);
      const sum = cours.reduce((a, c) => a + (c.episodes ?? 0), 0);
      // The boundaries only line up if AniList and TMDB agree on the total. When they don't (One
      // Piece is ongoing with no AniList count; JoJo's TMDB carries arcs AniList doesn't map), the
      // overlay would put the wrong episodes in the wrong season — so it is stored, and NOT trusted.
      const ok = info.episodes == null || sum === info.episodes;
      const source = ok ? "anilist" : "mismatch";
      ok ? resolved++ : mismatch++;

      const { error: upErr } = await supabase
        .from("anime_cours").upsert({ tmdb_id: tmdbId, cours, source, resolved_at: stamp });
      if (upErr) { failed++; log.push(`✗ ${info.title}: ${upErr.message}`); continue; }

      if (!ok) log.push(`⚠ ${info.title}: AniList ${sum} ≠ TMDB ${info.episodes} → flat fallback`);
      else log.push(`· ${info.title}: ${cours.length} season(s), ${sum} ep`);
    }

    return new Response(
      JSON.stringify({ ok: true, shows: batch.length, resolved, mismatch, none, failed, rateLimited, log }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
