// UPCOMING FROM PEOPLE YOU FOLLOW — the robot behind « Following » (Watching v4 §11, 2026-09-16).
//
// cron → table → app (R3/R6): every Tuesday this reads the union of everyone's follows
// (watching.person_follows), asks TMDB for each person's combined credits, keeps what is still
// to come — or just out — and rewrites watching.person_upcoming for that person. The app reads
// the table, joined to your own follows; it never calls TMDB per face.
//
// Also invoked for ONE person right after a follow (`{ person: <tmdb id> }`), so the new face's
// projects show up now, not next Tuesday. Same code path, one id.
//
// The weekly run ends with a second job that shares the same TMDB budget: the titles you OWN that
// are not out yet get their poster, date, title and cast refreshed (unreleased.ts).
//
// What counts as upcoming: a credit whose release (film) or first air date (series) is on or after
// today − 30 days — the month after a release keeps it visible as "out now". Undated credits are
// skipped (announced projects without a date are noise TMDB carries for years). Cast credits win
// over crew credits for the same title; crew keeps Directing and Writing only (an actor's
// "Executive Producer" line on his own show is not a project you are waiting for).
//
// NEW SEASONS (owner, 2026-09-17): a person's credits only date a show's FIRST air date, so an
// actor followed in a returning series never showed up. For each recurring series credit
// (3+ episodes) the robot asks the show for its seasons; a season dated ahead — or started within
// the month — is a premiere → the show enters with that date and `season_number`. Weekly episodes
// of a running season are not "upcoming" and stay out.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithRetry, errMsg } from "../_shared/retry.ts";
import { refreshUnreleased } from "./unreleased.ts";

const TMDB = "https://api.themoviedb.org/3";
const KEY = Deno.env.get("TMDB_API_KEY")!;
const KEEP_AFTER_DAYS = 30;
const CREW_DEPARTMENTS = new Set(["Directing", "Writing"]);
// The person page's own curation: a "Self" / archive / uncredited turn is not a project you wait for
// (a talk show, a festival reel, a documentary cameo). Same rule as getPersonBundle.
const NOT_A_PART = /^(self|himself|herself|themselves)\b|archive footage|\(uncredited\)/i;

interface Row {
  person_tmdb_id: number;
  media_type: "movie" | "tv";
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  role: string | null;
  department: string;
  season_number: number | null;
  synced_at: string;
}
const RECURRING_EPISODES = 3;

async function tmdb(path: string) {
  const res = await fetchWithRetry(`${TMDB}/${path}?api_key=${KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return res.json();
}

/**
 * The follow row carries a snapshot of the person (name, portrait, department) so the Following
 * rail draws without a call per face. Snapshots age — a new portrait, a corrected name — so the
 * weekly run refreshes them from TMDB for everyone following that person.
 */
async function refreshPerson(supabase: any, id: number) {
  const p = await tmdb(`person/${id}`);
  if (!p?.name) return;
  const { error } = await supabase.schema("watching").from("person_follows").update({
    name: p.name,
    profile_url: p.profile_path ? `https://image.tmdb.org/t/p/w300${p.profile_path}` : null,
    known_for: p.known_for_department ?? null,
  }).eq("person_tmdb_id", id);
  if (error) throw error;
}

function upcomingOf(personId: number, credits: any, floor: string): Row[] {
  const now = new Date().toISOString();
  const byKey = new Map<string, Row>();
  const consider = (c: any, role: string | null, department: string) => {
    const media_type = c.media_type === "movie" ? "movie" : c.media_type === "tv" ? "tv" : null;
    if (!media_type) return;
    const date: string | null = (media_type === "movie" ? c.release_date : c.first_air_date) || null;
    if (!date || date < floor) return;
    const key = `${media_type}:${c.id}`;
    const existing = byKey.get(key);
    // A cast credit names the part; it beats a crew line for the same title.
    if (existing && existing.department === "Acting") return;
    byKey.set(key, {
      person_tmdb_id: personId, media_type, tmdb_id: c.id,
      title: c.title || c.name || "", poster_path: c.poster_path ?? null,
      release_date: date, role, department, season_number: null, synced_at: now,
    });
  };
  for (const c of credits.cast ?? []) {
    if (c.character && NOT_A_PART.test(c.character)) continue;
    consider(c, c.character || null, "Acting");
  }
  for (const c of credits.crew ?? []) {
    if (!CREW_DEPARTMENTS.has(c.department)) continue;
    consider(c, c.job || null, c.department);
  }
  return [...byKey.values()];
}

/** The season premieres ahead among a person's recurring series — one show call per candidate. */
async function newSeasonsOf(personId: number, credits: any, floor: string, already: Set<string>): Promise<Row[]> {
  const now = new Date().toISOString();
  const out: Row[] = [];
  const shows = (credits.cast ?? []).filter((c: any) =>
    c.media_type === "tv" && (c.episode_count ?? 0) >= RECURRING_EPISODES && !already.has(`tv:${c.id}`)
    && !(c.character && NOT_A_PART.test(c.character)));
  for (const c of shows) {
    try {
      const show = await tmdb(`tv/${c.id}`);
      // A season TMDB has dated ahead (or that started within the month) — the honest premiere.
      // `next_episode_to_air` only appears days before airing, so it is the fallback, not the rule.
      const seasons: any[] = (show?.seasons ?? []).filter((s: any) => s.season_number > 0 && s.air_date && s.air_date >= floor);
      seasons.sort((a: any, b: any) => a.air_date.localeCompare(b.air_date));
      const next = show?.next_episode_to_air;
      const premiere = seasons[0]
        ? { air_date: seasons[0].air_date as string, season_number: seasons[0].season_number as number }
        : next?.air_date && next.episode_number === 1 && next.air_date >= floor
          ? { air_date: next.air_date as string, season_number: next.season_number as number }
          : null;
      if (!premiere) continue;
      out.push({
        person_tmdb_id: personId, media_type: "tv", tmdb_id: c.id,
        title: show.name || c.name || "", poster_path: show.poster_path ?? c.poster_path ?? null,
        release_date: premiere.air_date, role: c.character || null, department: "Acting",
        season_number: premiere.season_number, synced_at: now,
      });
    } catch (e) {
      console.error(`show ${c.id}: ${errMsg(e)}`);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("HEGON_SECRET_KEY")!,
    { global: { fetch: fetchWithRetry } },
  );
  const body = await req.json().catch(() => ({}));
  const one: number | null = Number.isInteger(body?.person) ? Number(body.person) : null;

  try {
    // Who to sync: one person, or everyone anybody follows.
    let people: number[];
    if (one) {
      people = [one];
    } else {
      const { data, error } = await supabase.schema("watching").from("person_follows").select("person_tmdb_id");
      if (error) throw error;
      people = [...new Set((data ?? []).map((r: any) => r.person_tmdb_id as number))];
    }

    const floor = new Date(Date.now() - KEEP_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
    let rows = 0;
    const failed: number[] = [];
    for (const id of people) {
      try {
        const credits = await tmdb(`person/${id}/combined_credits`);
        const fresh = upcomingOf(id, credits, floor);
        fresh.push(...await newSeasonsOf(id, credits, floor, new Set(fresh.map((r) => `${r.media_type}:${r.tmdb_id}`))));
        // Rewrite the person's slice: delete what was, insert what is (a handful of rows).
        const del = await supabase.schema("watching").from("person_upcoming").delete().eq("person_tmdb_id", id);
        if (del.error) throw del.error;
        if (fresh.length) {
          const ins = await supabase.schema("watching").from("person_upcoming").upsert(fresh, { onConflict: "person_tmdb_id,media_type,tmdb_id" });
          if (ins.error) throw ins.error;
        }
        rows += fresh.length;
        if (!one) await refreshPerson(supabase, id);
      } catch (e) {
        console.error(`person ${id}: ${errMsg(e)}`);
        failed.push(id);
      }
    }

    // Full run only: drop the slices of people nobody follows any more, then refresh the owned
    // titles that are not out yet.
    let unreleased: { scanned: number; updated: number; failed: number } | { error: string } | null = null;
    if (!one) {
      const { error } = people.length
        ? await supabase.schema("watching").from("person_upcoming").delete().not("person_tmdb_id", "in", `(${people.join(",")})`)
        : await supabase.schema("watching").from("person_upcoming").delete().gte("person_tmdb_id", 0);
      if (error) throw error;
      try { unreleased = await refreshUnreleased(supabase.schema("watching"), fetchWithRetry); }
      catch (e) { unreleased = { error: errMsg(e) }; console.error(`unreleased: ${errMsg(e)}`); }
    }

    // Everyone failed (a dead TMDB key, TMDB down): say so with a 500, so the watchdog's section B
    // counts it — a 200 wrapping a list of failures is a silent death.
    const allFailed = people.length > 0 && failed.length === people.length;
    return new Response(JSON.stringify({ ok: !allFailed, people: people.length, rows, failed, unreleased }), {
      status: allFailed ? 500 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: errMsg(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
