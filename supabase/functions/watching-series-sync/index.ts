// THE ENGINE. Without this, the whole model is a photograph of the day you added a title.
//
// `status`, `season_episodes` and `season_aired` are facts about the WORLD, and the world moves
// on its own. Nothing refreshed them, ever — so The Boys stayed "ongoing" for eternity, House of
// the Dragon's season 3 would never grow past the four episodes it had the day you added it, and
// a caught-up show could never light up as NEW, because nothing was ever going to tell it that
// season 4 had dropped. Every derived rule in the app is a function of two numbers; this job is
// what keeps the second one true.
//
// ── IT WORKS IN BATCHES, AND THAT IS NOT A COMPROMISE ─────────────────────────────────────────
// A full pass is well over a thousand TMDB calls, counted naively — nowhere near a single
// invocation's budget. So each run takes a slice, and the cron brings it back. A run that dies
// takes a batch with it, not the job.
//
// ── IT COUNTS SHOWS, NOT ROWS ─────────────────────────────────────────────────────────────────
// `media_items` is per-user: 239 rows, 124 distinct series. Walking rows asked TMDB the same
// question twice and hid a real defect — see `selectBatch`.
//
// ── AND NOT EVERYTHING DESERVES THE SAME ATTENTION ────────────────────────────────────────────
// Three quarters of the library is FINISHED. A job that re-verifies Breaking Bad as often as a show
// airing on Sunday is spending its whole budget confirming the obvious — so it doesn't.
//
// ── IT ONLY ASKS FOR WHAT COULD HAVE CHANGED ──────────────────────────────────────────────────
// Counting what aired means opening a season and counting episodes whose date has passed. Doing
// that for all 23 seasons of One Piece, forever, to re-learn that season 4 ended in 2003, is
// absurd. A season that has FULLY AIRED, ended in the past, and whose announced count hasn't moved,
// cannot change — so we reuse what we stored. That is what `season_end_dates` buys, and it
// typically cuts a long-running show to a single call.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB = "https://api.themoviedb.org/3";
const KEY = Deno.env.get("TMDB_API_KEY")!;

/** SHOWS per invocation (not rows — see selectBatch). Sized to finish well inside the wall clock. */
const BATCH = 25;

/**
 * ⚠️ COMPUTED PER RUN, NOT PER ISOLATE.
 *
 * As a module-level `const`, this froze the moment the isolate booted — and a warm isolate can
 * outlive midnight. The job would then spend hours counting with yesterday's date, so an episode
 * that aired TONIGHT stayed invisible until the isolate happened to be recycled. Precisely the
 * evening where freshness is the whole point of the job.
 */
const today = () => new Date().toISOString().slice(0, 10);

const FINISHED = new Set(["ended", "canceled", "cancelled"]);
const isFinished = (s: unknown) => FINISHED.has(String(s ?? "").toLowerCase());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path: string): Promise<any> {
  const qs = new URLSearchParams({ api_key: KEY, language: "en-US" });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${TMDB}/${path}?${qs}`);
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
    return res.json();
  }
  throw new Error(`TMDB rate-limited on ${path}`);
}

const total = (a: number[] | null | undefined) => (a ?? []).reduce((x, y) => x + (y || 0), 0);

const lastAired = (aired: number[]) => {
  for (let s = aired.length; s >= 1; s--) if ((aired[s - 1] ?? 0) > 0) return { season: s, episode: aired[s - 1] };
  return null;
};

interface SeasonFacts { aired: number; endDate: string | null; poster: string | null; airDate: string | null }

/**
 * What has ACTUALLY aired in each season, and when each season ENDED.
 *
 * TMDB's season list carries announced seasons at their full episode count, so the only honest
 * answer is to open the season and count the episodes whose air date has passed.
 *
 * Two traps, both of which have already bitten us:
 *   · An episode with NO air date has not aired. An unknown date is not a past date.
 *   · A season with no air date is NOT a future season — TMDB simply doesn't always carry one
 *     (One Piece has none on most of its 23). Reading a missing date as "unaired" once reported
 *     [61, 0, 0, 0…] for a show with a thousand episodes behind it. Only a date that is genuinely
 *     in the FUTURE lets us skip a season without asking.
 */
async function seasonFacts(
  tmdbId: number,
  seasons: any[],
  prev: { aired: number[] | null; announced: number[] | null; ends: (string | null)[] | null },
): Promise<SeasonFacts[]> {
  const out: SeasonFacts[] = [];
  const TODAY = today();

  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    const announced = s.episode_count ?? 0;
    // The poster and the start date come free with the show payload — no season call needed. They
    // are why `useSeasonRefresh` existed, firing a TMDB request on every detail-page open to write
    // the ANNOUNCED counts and never the aired ones. This job already knows everything that hook
    // knew, and more, so the hook is gone.
    const poster = s.poster_path ?? null;
    const airDate = s.air_date ?? null;

    // Genuinely not out yet.
    if (s.air_date && s.air_date > TODAY) {
      out.push({ aired: 0, endDate: null, poster, airDate });
      continue;
    }

    // Settled: fully aired, finished airing in the past, and nobody has added an episode to it
    // since. It cannot change. Reuse — this is what keeps a 23-season show cheap.
    const knownAired = prev.aired?.[i];
    const knownEnd = prev.ends?.[i] ?? null;
    const knownAnnounced = prev.announced?.[i];
    if (
      knownAired != null && knownEnd && knownEnd < TODAY &&
      knownAired === announced && knownAnnounced === announced
    ) {
      out.push({ aired: knownAired, endDate: knownEnd, poster, airDate });
      continue;
    }

    const detail = await tmdb(`tv/${tmdbId}/season/${s.season_number}`);
    const airedEps = (detail.episodes ?? []).filter((e: any) => e.air_date && e.air_date <= TODAY);
    out.push({
      aired: airedEps.length,
      // The END is the last episode that has actually aired — null while a season is mid-flight,
      // because there is no honest answer yet.
      endDate: airedEps.length === announced && airedEps.length > 0
        ? airedEps[airedEps.length - 1].air_date
        : null,
      poster,
      airDate,
    });
    await sleep(60);   // TMDB is generous, not infinite
  }

  return out;
}

// `recently_watched` was dropped (Last Watched derives from watched_at now). It lingered here after
// the column was gone, and this SELECT is the first thing the job does — so every run since has died
// on "column does not exist", silently: net.http_post is async, so the cron still reports success.
const ROW_COLUMNS =
  "id,title,tmdb_id,status,watched,in_progress,paused,dropped,current_season," +
  "current_episode,season_episodes,season_aired,season_end_dates,caught_up_at,watched_at,last_synced_at";

/** How stale a title has to be before it's worth asking TMDB again. */
const ONGOING_STALE_MS = 6 * 60 * 60 * 1000;        // a show that's airing: a few times a day
const FINISHED_STALE_MS = 7 * 24 * 60 * 60 * 1000;  // a show that's over: once a week, for revivals

const staleness = (rows: any[]) => {
  // The group is as stale as its OLDEST row — otherwise a row could be starved forever behind a
  // freshly-written sibling.
  let oldest = Infinity;
  for (const r of rows) {
    const t = r.last_synced_at ? new Date(r.last_synced_at).getTime() : 0;   // never synced = infinitely stale
    if (t < oldest) oldest = t;
  }
  return Date.now() - oldest;
};

function groupByShow(rows: any[]): Map<number, any[]> {
  const groups = new Map<number, any[]>();
  for (const r of rows) {
    const g = groups.get(r.tmdb_id);
    if (g) g.push(r); else groups.set(r.tmdb_id, [r]);
  }
  return groups;
}

/**
 * THE BATCH — chosen by SERIES, and by URGENCY.
 *
 * ── ONE SHOW IS ONE FETCH ─────────────────────────────────────────────────────────────────────
 * `media_items` is per-user, so the same show exists once per account: 239 rows for 124 distinct
 * series. The job used to walk ROWS, so it asked TMDB "where is House of the Dragon?" twice, to be
 * told the same thing twice — half the calls in a full pass were pure waste.
 *
 * And that waste hid a real defect. `status` and `season_aired` are facts about THE WORLD; they do
 * not belong to you. Yet each copy was refreshed independently, at its own place in the rotation —
 * so the day episode 5 airs, your row learns it at 10:00 and the demo's at 18:00, and for eight
 * hours the same show has TWO DIFFERENT TRUTHS in one database. Fetching once and writing to every
 * row that shares the tmdb_id makes that impossible by construction, not by luck.
 * (The proper cure is a shared `series_facts(tmdb_id)` table — the world's truth stored ONCE, with
 * media_items keeping only what is yours. This is the first step of it.)
 *
 * ── AND NOT EVERY SHOW DESERVES THE SAME ATTENTION ────────────────────────────────────────────
 * 180 of the 239 rows are FINISHED. Re-verifying every ten hours that Breaking Bad is still over is
 * absurd, and it was crowding out the 15 shows that actually air an episode this week. So finished
 * shows are checked weekly (revivals are real, but they are not hourly), and the batch goes to what
 * moves.
 */
async function selectBatch(supabase: any) {
  const pick = async (finished: boolean) => {
    let q = supabase
      .from("media_items")
      .select(ROW_COLUMNS)
      .neq("type", "film")
      .eq("is_reference", false)
      .not("tmdb_id", "is", null);
    q = finished
      ? q.in("status", ["ended", "canceled", "cancelled"])
      : q.or("status.is.null,status.not.in.(ended,canceled,cancelled)");
    const { data, error } = await q.order("last_synced_at", { ascending: true, nullsFirst: true });
    if (error) throw error;
    return (data ?? []) as any[];
  };

  const eligible = (rows: any[], maxAge: number) =>
    [...groupByShow(rows).entries()]
      .filter(([, g]) => staleness(g) >= maxAge)
      .sort((a, b) => staleness(b[1]) - staleness(a[1]));   // stalest first

  const batch = eligible(await pick(false), ONGOING_STALE_MS).slice(0, BATCH);
  if (batch.length < BATCH) {
    // Room left → top up with finished shows that haven't been looked at in a week.
    batch.push(...eligible(await pick(true), FINISHED_STALE_MS).slice(0, BATCH - batch.length));
  }
  return batch;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("HEGON_SECRET_KEY")!,
    { db: { schema: "watching" } },
  );

  try {
    const batch = await selectBatch(supabase);

    let changed = 0, repaired = 0, failed = 0, rows = 0;
    const log: string[] = [];

    for (const [tmdbId, group] of batch) {
      const title = group[0].title;
      rows += group.length;

      let show: any;
      try {
        show = await tmdb(`tv/${tmdbId}`);
      } catch (e) {
        failed++;
        log.push(`✗ ${title}: ${String(e)}`);
        continue;
      }

      const seasons = (show.seasons ?? []).filter((s: any) => s.season_number > 0);   // no Specials
      const raw = String(show.status ?? "").toLowerCase();
      const status = isFinished(raw) ? (raw === "ended" ? "ended" : "canceled") : "ongoing";
      const season_episodes: number[] = seasons.map((s: any) => s.episode_count ?? 0);

      // The freshest row is the baseline for "which seasons can I skip re-counting". A stale
      // baseline can only cost us extra TMDB calls, never a wrong answer: the reuse test compares
      // against TMDB's OWN episode_count, so anything that has moved fails it and gets refetched.
      const baseline = group.reduce((a, b) =>
        new Date(b.last_synced_at ?? 0).getTime() > new Date(a.last_synced_at ?? 0).getTime() ? b : a);

      const facts = await seasonFacts(tmdbId, seasons, {
        aired: baseline.season_aired,
        announced: baseline.season_episodes,
        ends: baseline.season_end_dates,
      });
      const season_aired = facts.map((f) => f.aired);

      // ── THE WORLD'S FACTS — identical for every row that shares this tmdb_id, written in ONE
      //    statement, so two copies of a show can never disagree about what has aired.
      const world = {
        status,
        seasons: seasons.length,
        episodes: total(season_episodes),
        season_episodes,
        season_aired,
        season_end_dates: facts.map((f) => f.endDate),
        season_posters: facts.map((f) => f.poster),
        season_air_dates: facts.map((f) => f.airDate),
        last_synced_at: new Date().toISOString(),   // this is what rotates the batch
      };

      const { error: worldErr } = await supabase
        .from("media_items").update(world).in("id", group.map((r) => r.id));
      if (worldErr) { failed++; log.push(`✗ ${title}: ${worldErr.message}`); continue; }

      const airedTotal = total(season_aired);
      if (
        baseline.status !== status ||
        JSON.stringify(baseline.season_aired) !== JSON.stringify(season_aired)
      ) {
        changed++;
        log.push(`· ${title}: ${baseline.status} → ${status}, aired ${total(baseline.season_aired)} → ${airedTotal}`);
      }

      // ── YOUR FACTS — per row, because your position is yours and the demo's is the demo's. ────
      const pos = lastAired(season_aired);

      for (const m of group) {
        const fix: Record<string, unknown> = {};

        // A row marked `watched` on a show that is NOT over. Never a user error: "watched" was the
        // only word the app knew. It means "I'm caught up" — so let it say that instead.
        if (m.watched && !isFinished(status) && airedTotal > 0 && pos) {
          Object.assign(fix, {
            watched: false,
            in_progress: true,
            paused: false,
            dropped: false,
            current_season: m.current_season ?? pos.season,
            current_episode: m.current_episode ?? pos.episode,
            caught_up_at: m.caught_up_at ?? m.watched_at ?? new Date().toISOString(),
          });
          log.push(`⚠ ${title}: watched → caught-up`);
        }
        // A finished show that GREW — a revival, a late special season.
        //
        // ⚠️ THIS CAN ONLY BE DETECTED AGAINST A PREVIOUS SNAPSHOT. The naive test ("more has aired
        // than you've seen") destroys the library: a watched show that was never given a position
        // reports zero seen, so Breaking Bad, Lost and Suits all look like they've grown and get
        // un-watched. Growth is a COMPARISON, not a deduction. No baseline → no claim.
        else if (
          m.watched && isFinished(status) &&
          m.season_aired != null && airedTotal > total(m.season_aired)
        ) {
          Object.assign(fix, {
            watched: false,
            // A revival does not un-drop a show. If you walked away from it, you walked away from
            // it — the world coming back with more episodes is not you changing your mind. The
            // stance you chose survives; only the false claim of completion dies.
            in_progress: !m.paused && !m.dropped,
            current_season: m.current_season ?? 1,
            current_episode: m.current_episode ?? 0,
            caught_up_at: m.caught_up_at ?? m.watched_at ?? new Date().toISOString(),
          });
          log.push(`⚠ ${title}: finished show grew (${total(m.season_aired)} → ${airedTotal} aired)`);
        }

        /**
         * A ROW THAT CLAIMS THE IMPOSSIBLE. The app clamps a position beyond what aired so nothing
         * *displays* wrong — which is right, and which also means a corrupt row can sit there for
         * years in perfect silence. The three we know about (a True Detective at S4 E6 when only
         * season 1 was watched — it's an anthology) were found by accident, on a screen, by eye.
         * This job opens every row anyway: noticing costs nothing, and a clamp that hides a
         * contradiction instead of reporting it is a bug wearing the coat of a safety feature.
         */
        const airedHere = season_aired[(m.current_season ?? 1) - 1] ?? 0;
        if ((m.current_episode ?? 0) > airedHere) {
          log.push(`⚠ ${title}: position S${m.current_season}E${m.current_episode} claims more than aired (${airedHere})`);
        }

        if (Object.keys(fix).length === 0) continue;
        repaired++;
        const { error: fixErr } = await supabase.from("media_items").update(fix).eq("id", m.id);
        if (fixErr) { failed++; log.push(`✗ ${title}: ${fixErr.message}`); }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, shows: batch.length, rows, changed, repaired, failed, log }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
