// One-off: reconstruct watched_at for COMPLETED series/anime from the data entered
// via Watch History — set it to Dec 31 (noon UTC) of the latest watched season's
// year, so it reflects the real finish year (the app stored the date you ADDED it,
// not when you watched it). Used by goals / "Finished" / Recently Watched ordering.
//
//   node scripts/fix-watched-at.mjs
//
// Scope: watched=true series/anime WITH season_years filled AND max(year) <= 2025
// (protects 2026 = current year, whose watched_at may be real/recent). Films and
// in-progress are untouched. Idempotent. Reads env from .env.local.

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
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: "watching" },
  auth: { persistSession: false },
});

async function main() {
  const { data: items, error } = await supabase
    .from("media_items")
    .select("id, title, season_years")
    .in("type", ["serie", "anime"])
    .eq("watched", true);
  if (error) throw error;

  const targets = (items ?? [])
    .map((i) => ({ ...i, years: Object.values(i.season_years ?? {}).map(Number).filter((y) => !Number.isNaN(y)) }))
    .filter((i) => i.years.length > 0 && Math.max(...i.years) <= 2025);

  console.log(`${targets.length} series/anime to fix (of ${items?.length ?? 0} completed).`);

  let ok = 0, fail = 0;
  for (const item of targets) {
    const maxYear = Math.max(...item.years);
    const watchedAt = `${maxYear}-12-31T12:00:00Z`;
    try {
      const { error: upErr } = await supabase
        .from("media_items")
        .update({ watched_at: watchedAt })
        .eq("id", item.id);
      if (upErr) throw upErr;
      ok++;
      console.log(`✓  ${item.title} → ${maxYear}-12-31`);
    } catch (e) {
      fail++;
      console.log(`✗  ${item.title}: ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
