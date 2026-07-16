import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

// ─── Configuration ─────────────────────────────────────────────────────────
const CONFIG = {
  max_pages:            1,   // Une seule page = 50 joueurs
  max_rank_wanted:      50,
  delay_between_pages_ms: 1500,
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function extractSlug(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/\/player\/([^\/]+)\//);
  return match ? match[1] : null;
}

function extractCountry(href: string | null): string {
  if (!href) return "";
  const match = href.match(/country=([^&]+)/);
  if (!match) return "";
  const country = match[1];
  return country.charAt(0).toUpperCase() + country.slice(1);
}

// ─── Scraping de la page de ranking ────────────────────────────────────────
async function scrapeRankingsPage(pageNumber: number) {
  const url = `https://www.tennisexplorer.com/ranking/atp-men/?page=${pageNumber}`;
  console.log(`\n🌐 Fetching page ${pageNumber}: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Referer": "https://www.tennisexplorer.com/",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} for page ${pageNumber}`);

  const html = await response.text();
  console.log(`📄 HTML received: ${html.length} characters`);

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse HTML");

  const rows = doc.querySelectorAll("table.result tbody.flags tr");
  console.log(`📋 Found ${rows.length} rows in ranking table`);

  const players: Array<{
    rank: number;
    name: string;
    country: string;
    points: number;
    slug: string | null;
  }> = [];

  for (const row of rows) {
    try {
      const rankEl   = row.querySelector("td.rank.first");
      const nameEl   = row.querySelector("td.t-name a");
      const countryEl = row.querySelector("td.t1 a");
      const pointsEl = row.querySelector("td.long-point");

      if (!rankEl || !nameEl || !pointsEl) {
        console.log(`⚠️  Skipping row (missing elements)`);
        continue;
      }

      const rank   = parseInt(rankEl.textContent?.trim().replace(/\D/g, "") || "0", 10);
      const name   = nameEl.textContent?.trim() || "";
      const slug   = extractSlug(nameEl.getAttribute("href"));
      const country = extractCountry(countryEl?.getAttribute("href") || "");
      const points = parseInt(pointsEl.textContent?.trim().replace(/\D/g, "") || "0", 10);

      if (rank && name && points) {
        console.log(`  ✓ Rank ${rank}: ${name} (${country}) → slug: ${slug || "N/A"} → ${points} pts`);
        players.push({ rank, name, country, points, slug });
      }
    } catch (err) {
      console.error(`⚠️  Error parsing row:`, err);
    }
  }

  console.log(`\n✅ Total players parsed: ${players.length}`);
  return players;
}

// ─── Sync vers Supabase ────────────────────────────────────────────────────
async function syncToSupabase(
  supabase: any,
  players: Array<{ rank: number; name: string; country: string; points: number; slug: string | null }>
) {
  let created = 0, updated = 0, slugsFound = 0;

  // 1. Batch-fetch tous les joueurs existants une seule fois → deux Maps pour O(1) lookup
  //    Élimine ~100 SELECT séquentiels dans la boucle
  const { data: existingPlayers, error: fetchError } = await supabase
    .from("tennis_players")
    .select("id, name, tennis_explorer_slug")

  if (fetchError) throw new Error(`Error fetching existing players: ${fetchError.message}`)

  const bySlug = new Map<string, { id: string; name: string }>(
    existingPlayers?.filter((p: any) => p.tennis_explorer_slug)
      .map((p: any) => [p.tennis_explorer_slug, { id: p.id, name: p.name }]) ?? []
  )
  const byName = new Map<string, { id: string }>(
    existingPlayers?.map((p: any) => [p.name, { id: p.id }]) ?? []
  )
  console.log(`\n📦 Player map loaded: ${existingPlayers?.length ?? 0} existing players`)

  // 2. Rankings à upsert — collectés pendant la boucle, envoyés en batch après
  const rankingsToUpsert: Array<{ player_id: string; rank: number; points: number; updated_at: string }> = []

  for (const player of players) {
    console.log(`\n💾 Processing: ${player.name}...`);

    if (player.slug) slugsFound++;

    // Lookup O(1) — slug d'abord (plus fiable), nom exact en fallback
    const existing = (player.slug ? bySlug.get(player.slug) : null) ?? byName.get(player.name)

    let playerId: string

    if (existing) {
      const { data: updatedPlayer, error: updateError } = await supabase
        .from("tennis_players")
        .update({
          name: player.name,
          country: player.country,
          tennis_explorer_slug: player.slug,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single()

      if (updateError || !updatedPlayer) {
        console.error(`  ❌ Error updating player ${player.name}:`, updateError)
        continue
      }

      playerId = updatedPlayer.id
      updated++
      console.log(`  ✓ Player updated`)
    } else {
      const { data: newPlayer, error: insertError } = await supabase
        .from("tennis_players")
        .insert({ name: player.name, country: player.country, tennis_explorer_slug: player.slug })
        .select("id")
        .single()

      if (insertError || !newPlayer) {
        console.error(`  ❌ Error inserting player ${player.name}:`, insertError)
        continue
      }

      playerId = newPlayer.id
      created++
      console.log(`  ✓ Player created`)
    }

    // Collecter le ranking — sera upsert en batch après la boucle
    rankingsToUpsert.push({
      player_id: playerId,
      rank: player.rank,
      points: player.points,
      updated_at: new Date().toISOString(),
    })
  }

  // 3. Batch upsert tous les rankings en un seul appel
  //    Remplace 100 SELECT+UPDATE/INSERT individuels (50 SELECT + 50 UPDATE/INSERT)
  if (rankingsToUpsert.length > 0) {
    const { error: rankingsError } = await supabase
      .from("tennis_rankings")
      .upsert(rankingsToUpsert, { onConflict: "player_id" })

    if (rankingsError) {
      console.error(`❌ Error upserting rankings:`, rankingsError)
    } else {
      console.log(`\n✅ Rankings batch upsert: ${rankingsToUpsert.length} rows`)
    }
  }

  return { created, updated, rankingsUpserted: rankingsToUpsert.length, slugsFound }
}

// ─── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async () => {
  try {
    console.log("🎾 Starting Tennis Rankings Sync...\n");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: "sport" },
    });

    const allPlayers: Array<{ rank: number; name: string; country: string; points: number; slug: string | null }> = []

    for (let page = 1; page <= CONFIG.max_pages; page++) {
      const players = await scrapeRankingsPage(page);
      console.log(`\n  ✓ Scraped ${players.length} players from page ${page}`);

      for (const p of players) {
        if (p.rank <= CONFIG.max_rank_wanted) allPlayers.push(p);
      }

      if (page < CONFIG.max_pages) {
        console.log(`\n⏳ Waiting ${CONFIG.delay_between_pages_ms}ms...`);
        await new Promise((r) => setTimeout(r, CONFIG.delay_between_pages_ms));
      }
    }

    console.log(`\n📊 Total players to sync: ${allPlayers.length}`);
    console.log(`🔗 Players with slugs: ${allPlayers.filter(p => p.slug).length}`);

    const stats = await syncToSupabase(supabase, allPlayers);

    console.log(`\n🎉 SYNC COMPLETE!`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced top ${CONFIG.max_rank_wanted} players (${stats.slugsFound} slugs found)`,
        players_scraped:    allPlayers.length,
        players_created:    stats.created,
        players_updated:    stats.updated,
        rankings_upserted:  stats.rankingsUpserted,
        slugs_found:        stats.slugsFound,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
