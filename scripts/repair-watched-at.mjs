// REPAIR `watched_at` FOR SERIES — where it drifted from the truth.
//
//   node scripts/repair-watched-at.mjs            → DRY RUN. Shows every change, writes nothing.
//   node scripts/repair-watched-at.mjs --apply    → actually writes.
//
// WHY
// `watched_at` for a series was, for a long time, the moment you MARKED it in the app — not when
// you watched it. So Hunter x Hunter (1999), finished in 2014, sat atop "Last Watched" with a
// "2 weeks ago" badge; Blue Lock, whose last episode aired Dec 2024, carried a Feb-2023 date that
// is flatly impossible (you cannot finish a show before its last episode exists).
//
// The write paths are fixed going forward (markWatchedPatch, the year edit, positionPatch all
// derive watched_at from the season's finish year now). This repairs the ROWS already written.
//
// TWO TIERS, and neither invents a date:
//   · TIER 1 — the row HAS season_years (your own record of when you watched each season). The
//     truth is max(season_years). Set watched_at to the end of that year. (buildWatchedAt maps the
//     CURRENT year back to `now`, so a show finished this year keeps a live timestamp.)
//   · TIER 2 — no season_years, so the real date is unknown and we do NOT guess it. We only fix the
//     IMPOSSIBLE: a watched_at earlier than the show finished airing. It gets bumped up to the
//     finish-air date (you couldn't have watched it before then). A plausible later date — you
//     watched Chernobyl in 2023 though it aired in 2019 — is LEFT ALONE. We can only remove an
//     impossibility, never overwrite a maybe-correct value.
//
// Idempotent. Re-running changes nothing already correct.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* optional */ }
}
loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const db = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "watching" } });

const NOW = new Date();
const NOW_YEAR = NOW.getFullYear();

// ── The one construction rule, mirrored from src/modules/watching/lib/watched-date.ts ──────────
function buildWatchedAt(year) {
  // Year only. A past year → its close (Dec 31). The current/future year → now (Dec 31 this year
  // hasn't happened, and we never date a viewing in the future).
  return year >= NOW_YEAR
    ? NOW.toISOString()
    : new Date(Date.UTC(year, 11, 31, 12)).toISOString();
}

const maxYear = (map) => {
  const ys = Object.values(map ?? {}).filter((y) => typeof y === "number");
  return ys.length ? Math.max(...ys) : null;
};

// The date the show FINISHED airing: the latest non-null season end date that is in the past.
const finishAirDate = (m) => {
  const ends = (m.season_end_dates ?? []).filter((d) => d && d <= NOW.toISOString().slice(0, 10));
  if (ends.length) return ends.sort().at(-1);
  // Fallback for rows the sync hasn't stamped end dates on yet: the latest season START date. A
  // watched_at before the last season even BEGAN is still impossible.
  const starts = (m.season_air_dates ?? []).filter((d) => d && d <= NOW.toISOString().slice(0, 10));
  return starts.length ? starts.sort().at(-1) : null;
};

const { data: items, error } = await db
  .from("media_items")
  .select("id,title,type,watched_at,season_years,season_end_dates,season_air_dates")
  .neq("type", "film")
  .eq("watched", true);
if (error) { console.error(error.message); process.exit(1); }

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${items.length} watched series/animes\n`);

let tier1 = 0, tier2 = 0, failed = 0;

for (const m of items) {
  let next = null;
  let reason = "";

  const my = maxYear(m.season_years);
  if (my != null) {
    // TIER 1 — trust your own season years.
    const target = buildWatchedAt(my);
    const currentYear = m.watched_at ? new Date(m.watched_at).getUTCFullYear() : null;
    if (currentYear !== my) {
      next = target;
      reason = `TIER 1  season_years max ${my}  (was ${currentYear ?? "null"})`;
      tier1++;
    }
  } else {
    // TIER 2 — only correct the impossible.
    const finish = finishAirDate(m);
    if (finish && m.watched_at && m.watched_at.slice(0, 10) < finish) {
      next = new Date(Date.UTC(+finish.slice(0, 4), +finish.slice(5, 7) - 1, +finish.slice(8, 10), 12)).toISOString();
      reason = `TIER 2  impossible: watched ${m.watched_at.slice(0, 10)} < aired ${finish}  → ${finish}`;
      tier2++;
    }
  }

  if (!next) continue;

  console.log(`  ${m.title}`);
  console.log(`      ${reason}`);

  if (APPLY) {
    const { error: upErr } = await db.from("media_items").update({ watched_at: next }).eq("id", m.id);
    if (upErr) { console.log(`      ✗ write failed: ${upErr.message}`); failed++; }
  }
}

console.log(
  `\n${tier1} fixed from season_years · ${tier2} impossible dates bumped · ${failed} failed` +
  (APPLY ? "" : "\n\nNothing was written. Re-run with --apply."),
);
