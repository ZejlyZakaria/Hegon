import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

// ─── Configuration ─────────────────────────────────────────────────────────
const CONFIG = {
  delay_between_players_ms: 1000,
  max_finished_matches_per_player: 3,
  max_played_matches_for_new_favorites: 3,
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface Match {
  atp_match_id: string;
  tournament_slug: string | null;
  tournament_url: string | null;
  round: string;
  match_date: string;
  opponent_name: string;
  opponent_slug: string | null;
  status: 'scheduled' | 'finished';
  score: string | null;
  winner: 'player' | 'opponent' | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function extractSlug(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/\/player\/([^\/]+)\//);
  return match ? match[1] : null;
}

function extractMatchId(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/\?id=(\d+)/);
  return match ? match[1] : null;
}

function extractTournament(href: string | null): { slug: string | null; url: string | null } {
  if (!href) return { slug: null, url: null };
  const segments = href.split('/').filter(s => s);
  if (segments.length < 3) return { slug: null, url: null };
  const slug = segments[0];
  const url = `https://www.tennisexplorer.com${href}`;
  return { slug, url };
}

// Année dynamique — ne cassera pas en janvier de l'année suivante
function parseDate(dateStr: string, year: number = new Date().getFullYear()): string {
  try {
    const parts = dateStr.trim().split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || "12:00";

    const [day, month] = datePart.replace(/\.$/, '').split('.');
    const [hour, minute] = timePart.split(':');

    if (!day || !month || !hour || !minute) {
      console.warn(`⚠️  Invalid date format: "${dateStr}", using default`);
      return `${year}-01-01T12:00:00Z`;
    }

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`;
  } catch (err) {
    console.error(`❌ Error parsing date "${dateStr}":`, err);
    return `${year}-01-01T12:00:00Z`;
  }
}

// ─── Scraper : Next Match ──────────────────────────────────────────────────
function scrapeNextMatch(doc: any, playerName: string): Match | null {
  try {
    const table = doc.querySelector('table.result.gamedetail');
    if (!table) {
      console.log('  ℹ️  No next match table found');
      return null;
    }

    const rows = table.querySelectorAll('tbody tr.one, tbody tr.two');
    if (!rows || rows.length === 0) {
      console.log('  ℹ️  No next match rows found');
      return null;
    }

    console.log(`  🔍 Scanning ${rows.length} potential next matches...`);

    for (const row of rows) {
      try {
        const matchEl = row.querySelector('th.t-name a');
        const matchText = matchEl?.textContent?.trim() || '';

        if (matchText.includes('/')) {
          console.log(`  ⚠️  DOUBLES match detected, skipping: "${matchText}"`);
          continue;
        }

        console.log(`  🔍 Processing SINGLES match: "${matchText}"`);

        const tournamentEl = row.querySelector('td.tl a');
        const tournamentHref = tournamentEl?.getAttribute('href');
        const tournament = extractTournament(tournamentHref);

        const roundEl = row.querySelector('td[title*="round"]');
        const round = roundEl?.textContent?.trim() || '';

        const dateEl = row.querySelector('td.time.noWrp');
        const dateStr = dateEl?.textContent?.trim() || '';
        const match_date = parseDate(dateStr);

        const matchId = extractMatchId(matchEl?.getAttribute('href'));

        if (!matchId || !matchText.includes(' - ')) {
          console.log('  ⚠️  Incomplete match data, trying next row');
          continue;
        }

        const playerLastName = playerName.split(/\s+/)[0];
        const [player1, player2] = matchText.split(' - ').map(s => s.trim());

        let opponentName: string;
        if (player1.includes(playerLastName)) {
          opponentName = player2;
        } else if (player2.includes(playerLastName)) {
          opponentName = player1;
        } else {
          opponentName = player2;
        }

        console.log(`  ✅ Next SINGLES match found: vs ${opponentName} on ${dateStr} (${round})`);

        return {
          atp_match_id: matchId,
          tournament_slug: tournament.slug,
          tournament_url: tournament.url,
          round,
          match_date,
          opponent_name: opponentName,
          opponent_slug: null,
          status: 'scheduled',
          score: null,
          winner: null,
        };

      } catch (err) {
        console.error('  ⚠️  Error processing row, trying next:', err);
        continue;
      }
    }

    console.log('  ℹ️  No SINGLES match found (all were doubles or invalid)');
    return null;

  } catch (err) {
    console.error('  ❌ Error scraping next match:', err);
    return null;
  }
}

// ─── Scraper : Played Matches ─────────────────────────────────────────────
function scrapePlayedMatches(doc: any, playerName: string): Match[] {
  const matches: Match[] = [];

  try {
    // Année dynamique — fonctionne sans modification chaque année
    const currentYear = new Date().getFullYear();
    const matchesDiv = doc.querySelector(`div[id^="matches-${currentYear}-"][id$="-data"]`);
    if (!matchesDiv) {
      console.log('  ℹ️  No played matches section found');
      return matches;
    }

    const table = matchesDiv.querySelector('table.result.balance');
    if (!table) {
      console.log('  ⚠️  No played matches table found');
      return matches;
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) {
      console.log('  ⚠️  No tbody found');
      return matches;
    }

    const allRows = tbody.querySelectorAll('tr');

    let currentTournamentSlug: string | null = null;
    let currentTournamentUrl: string | null = null;
    let matchCount = 0;

    for (const row of allRows) {
      const classes = row.getAttribute('class') || '';

      if (classes.includes('head')) {
        const tournamentEl = row.querySelector('td.t-name a');
        const tournamentHref = tournamentEl?.getAttribute('href');
        const tournament = extractTournament(tournamentHref);
        currentTournamentSlug = tournament.slug;
        currentTournamentUrl = tournament.url;
        continue;
      }

      if (classes.includes('one') || classes.includes('two')) {
        if (matchCount >= CONFIG.max_played_matches_for_new_favorites) break;

        try {
          const nameCell = row.querySelector('td.t-name');
          if (!nameCell) continue;

          const matchText = nameCell.textContent?.trim() || '';

          if (matchText.includes('/')) {
            console.log(`  ⚠️  DOUBLES match in played, skipping`);
            continue;
          }

          const dateEl = row.querySelector('td.first.time');
          const dateStr = dateEl?.textContent?.trim() || '';
          const match_date = parseDate(dateStr);

          const opponentLink = nameCell.querySelector('a:not(.notU)');
          if (!opponentLink) continue;

          const opponentName = opponentLink.textContent?.trim() || '';
          const opponentSlug = extractSlug(opponentLink.getAttribute('href'));

          const allLinks = nameCell.querySelectorAll('a');
          const firstLink = allLinks[0];
          const winner: 'player' | 'opponent' = firstLink?.classList.contains('notU') ? 'player' : 'opponent';

          const roundEl = row.querySelector('td.round');
          const round = roundEl?.textContent?.trim() || '';

          const scoreEl = row.querySelector('td.tl a');
          const score = scoreEl?.textContent?.trim() || '';
          const matchId = extractMatchId(scoreEl?.getAttribute('href'));

          if (!matchId || !opponentName || !score) continue;

          matches.push({
            atp_match_id: matchId,
            tournament_slug: currentTournamentSlug,
            tournament_url: currentTournamentUrl,
            round,
            match_date,
            opponent_name: opponentName,
            opponent_slug: opponentSlug,
            status: 'finished',
            score,
            winner,
          });

          matchCount++;

        } catch (err) {
          console.error('  ⚠️  Error parsing played match row:', err);
        }
      }
    }

  } catch (err) {
    console.error('  ❌ Error scraping played matches:', err);
  }

  return matches;
}

// ─── Scraper : Page joueur ─────────────────────────────────────────────────
async function scrapePlayerMatches(playerSlug: string, playerName: string) {
  const url = `https://www.tennisexplorer.com/player/${playerSlug}/`;
  console.log(`\n🌐 Fetching player page: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://www.tennisexplorer.com/',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${playerSlug}`);

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc) throw new Error('Failed to parse HTML');

  const nextMatch = scrapeNextMatch(doc, playerName);
  const playedMatches = scrapePlayedMatches(doc, playerName);

  return { nextMatch, playedMatches, doc };
}

// ─── DB : Match tournament ─────────────────────────────────────────────────
async function matchTournament(supabase: any, tournamentSlug: string | null): Promise<string | null> {
  if (!tournamentSlug) return null;

  const { data } = await supabase
    .from('tennis_tournaments')
    .select('id')
    .ilike('slug', `%${tournamentSlug}%`)
    .maybeSingle();

  return data?.id || null;
}

// ─── DB : Get or create opponent cache ────────────────────────────────────
async function getOrCreateOpponentCache(
  supabase: any,
  opponentName: string,
  opponentSlug: string | null
): Promise<string | null> {
  const { data: cached } = await supabase
    .from('tennis_players_cache')
    .select('id')
    .eq('name', opponentName)
    .maybeSingle();

  if (cached) return cached.id;

  try {
    const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(opponentName)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.player && data.player.length > 0) {
      const player = data.player.find((p: any) =>
        p.strSport === 'Tennis' && p.strTeam === 'ATP Mens'
      );

      if (player) {
        const { data: newCache } = await supabase
          .from('tennis_players_cache')
          .insert({
            name: opponentName,
            thesportsdb_id: parseInt(player.idPlayer),
            country: player.strNationality,
            birth_date: player.dateBorn || null,
            photo_thumb_url: player.strThumb,
            photo_cutout_url: player.strCutout,
          })
          .select('id')
          .single();

        return newCache.id;
      }
    }
  } catch (err) {
    console.log(`    ⚠️  TheSportsDB API error:`, err);
  }

  // Fallback : upsert sur name pour éviter les doublons si le cron retourne
  try {
    const { data: fallbackCache } = await supabase
      .from('tennis_players_cache')
      .upsert({ name: opponentName }, { onConflict: 'name' })
      .select('id')
      .single();

    return fallbackCache.id;
  } catch (err) {
    console.log(`    ❌ Failed to cache opponent:`, err);
    return null;
  }
}

// ─── DB : Update scheduled → finished ─────────────────────────────────────
async function updateScheduledToFinished(
  supabase: any,
  player: any,
  playedMatches: Match[]
) {
  console.log(`  🔄 Checking scheduled matches for ${player.name}...`);

  const { data: scheduledMatches } = await supabase
    .from('tennis_matches')
    .select('id, atp_match_id')
    .eq('player_id', player.id)
    .eq('status', 'scheduled');

  if (!scheduledMatches || scheduledMatches.length === 0) {
    console.log(`  ℹ️  No scheduled matches to check`);
    return 0;
  }

  console.log(`  📋 Found ${scheduledMatches.length} scheduled match(es)`);

  let updated = 0;

  for (const scheduled of scheduledMatches) {
    const found = playedMatches.find(p => p.atp_match_id === scheduled.atp_match_id);

    if (found) {
      console.log(`  ✅ Updating scheduled → finished: ${found.atp_match_id}`);

      const tournamentId = await matchTournament(supabase, found.tournament_slug);
      const opponentCacheId = await getOrCreateOpponentCache(
        supabase,
        found.opponent_name,
        found.opponent_slug
      );

      await supabase
        .from('tennis_matches')
        .update({
          status: 'finished',
          score: found.score,
          winner: found.winner,
          tournament_id: tournamentId,
          opponent_cache_id: opponentCacheId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduled.id);

      updated++;
    }
  }

  if (updated > 0) {
    console.log(`  🎉 Updated ${updated} match(es) to finished`);
  } else {
    console.log(`  ℹ️  No scheduled matches found in played results`);
  }

  return updated;
}

// ─── DB : Sync played matches (pour nouveaux favoris) ─────────────────────
async function syncPlayedMatches(supabase: any, playerId: string, matches: Match[]) {
  let created = 0;

  for (const match of matches) {
    try {
      const tournamentId = await matchTournament(supabase, match.tournament_slug);
      const opponentCacheId = await getOrCreateOpponentCache(
        supabase,
        match.opponent_name,
        match.opponent_slug
      );

      const { error } = await supabase
        .from('tennis_matches')
        .upsert({
          atp_match_id: match.atp_match_id,
          player_id: playerId,
          tournament_id: tournamentId,
          tournament_url: match.tournament_url,
          opponent_cache_id: opponentCacheId,
          opponent_name: match.opponent_name,
          match_date: match.match_date,
          status: match.status,
          round: match.round,
          score: match.score,
          winner: match.winner,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'atp_match_id,player_id',
        });

      if (error) {
        console.error(`    ❌ Error upserting match:`, error);
        continue;
      }

      created++;

    } catch (err) {
      console.error(`    ❌ Error syncing match:`, err);
    }
  }

  return { created };
}

// ─── DB : Sync next match ──────────────────────────────────────────────────
async function syncNextMatch(
  supabase: any,
  playerId: string,
  nextMatch: Match | null
) {
  if (!nextMatch) {
    console.log('  ℹ️  No next match to sync');
    return { inserted: 0 };
  }

  try {
    const tournamentId = await matchTournament(supabase, nextMatch.tournament_slug);
    const opponentCacheId = await getOrCreateOpponentCache(
      supabase,
      nextMatch.opponent_name,
      nextMatch.opponent_slug
    );

    const { error } = await supabase
      .from('tennis_matches')
      .upsert({
        atp_match_id: nextMatch.atp_match_id,
        player_id: playerId,
        tournament_id: tournamentId,
        tournament_url: nextMatch.tournament_url,
        opponent_cache_id: opponentCacheId,
        opponent_name: nextMatch.opponent_name,
        match_date: nextMatch.match_date,
        status: nextMatch.status,
        round: nextMatch.round,
        score: nextMatch.score,
        winner: nextMatch.winner,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'atp_match_id,player_id',
      });

    if (error) {
      console.error(`    ❌ Error syncing next match:`, error);
      return { inserted: 0 };
    }

    console.log(`    ✅ Next match synced`);
    return { inserted: 1 };

  } catch (err) {
    console.error(`  ❌ Error syncing next match:`, err);
    return { inserted: 0 };
  }
}

// ─── DB : Cleanup old matches ──────────────────────────────────────────────
async function cleanupOldMatches(supabase: any, playerId: string) {
  try {
    const { data: finishedMatches } = await supabase
      .from('tennis_matches')
      .select('id, match_date')
      .eq('player_id', playerId)
      .eq('status', 'finished')
      .order('match_date', { ascending: false });

    if (!finishedMatches || finishedMatches.length <= CONFIG.max_finished_matches_per_player) {
      return 0;
    }

    const toDelete = finishedMatches.slice(CONFIG.max_finished_matches_per_player);
    const idsToDelete = toDelete.map(m => m.id);

    await supabase
      .from('tennis_matches')
      .delete()
      .in('id', idsToDelete);

    console.log(`  🗑️  Deleted ${toDelete.length} old match(es)`);
    return toDelete.length;

  } catch (err) {
    console.error(`  ❌ Error cleaning up:`, err);
    return 0;
  }
}

// ─── DB : Cleanup matches pour joueurs non-favoris ────────────────────────
async function cleanupNonFavoriteMatches(supabase: any) {
  console.log(`\n🧹 Cleaning up matches for non-favorite players...`);

  try {
    const { data: playersWithMatches } = await supabase
      .from('tennis_matches')
      .select('player_id')
      .not('player_id', 'is', null);

    if (!playersWithMatches || playersWithMatches.length === 0) return 0;

    const uniquePlayerIds = [...new Set(playersWithMatches.map((m: any) => m.player_id))];

    const { data: favorites } = await supabase
      .from('user_favorites')
      .select('entity_id')
      .eq('entity_type', 'tennis_player');

    const favoriteIds = favorites?.map((f: any) => f.entity_id) || [];
    const nonFavoriteIds = uniquePlayerIds.filter(id => !favoriteIds.includes(id));

    if (nonFavoriteIds.length === 0) return 0;

    await supabase
      .from('tennis_matches')
      .delete()
      .in('player_id', nonFavoriteIds);

    console.log(`  ✅ Cleaned ${nonFavoriteIds.length} non-favorite player(s)`);
    return nonFavoriteIds.length;

  } catch (err) {
    console.error(`  ❌ Error during cleanup:`, err);
    return 0;
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async () => {
  try {
    console.log('🎾 Starting Tennis Matches Sync...\n');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'sport' },
    });

    const nonFavoritesCleaned = await cleanupNonFavoriteMatches(supabase);

    const { data: favoriteIds, error: favError } = await supabase
      .from('user_favorites')
      .select('entity_id')
      .eq('entity_type', 'tennis_player');

    if (favError) throw favError;

    if (!favoriteIds || favoriteIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No favorite players to sync',
          players_processed: 0,
          non_favorites_cleaned: nonFavoritesCleaned,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const playerIds = favoriteIds.map(f => f.entity_id);

    const { data: players, error: playersError } = await supabase
      .from('tennis_players')
      .select('id, name, tennis_explorer_slug')
      .in('id', playerIds)
      .not('tennis_explorer_slug', 'is', null);

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No players with slugs found',
          players_processed: 0,
          non_favorites_cleaned: nonFavoritesCleaned,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${players.length} player(s) with slug(s)\n`);

    let playersProcessed    = 0;
    let totalInserted       = 0;
    let totalUpdated        = 0;
    let totalDeleted        = 0;
    let newFavoritesDetected = 0;

    for (const player of players) {
      if (!player.tennis_explorer_slug) continue;

      console.log(`\n💾 Processing: ${player.name}`);

      try {
        const { data: existingMatches } = await supabase
          .from('tennis_matches')
          .select('id')
          .eq('player_id', player.id)
          .limit(1);

        const isNewFavorite = !existingMatches || existingMatches.length === 0;

        if (isNewFavorite) {
          console.log(`  🆕 NEW FAVORITE DETECTED!`);
          newFavoritesDetected++;
        }

        const { nextMatch, playedMatches } = await scrapePlayerMatches(
          player.tennis_explorer_slug,
          player.name
        );

        const updatedCount = await updateScheduledToFinished(supabase, player, playedMatches);
        totalUpdated += updatedCount;

        if (isNewFavorite && playedMatches.length > 0) {
          console.log(`  📊 Syncing ${playedMatches.length} played matches`);
          await syncPlayedMatches(supabase, player.id, playedMatches);
        }

        const syncStats = await syncNextMatch(supabase, player.id, nextMatch);
        totalInserted += syncStats.inserted;

        const deletedCount = await cleanupOldMatches(supabase, player.id);
        totalDeleted += deletedCount;

        playersProcessed++;
        console.log(`  ✅ Sync complete for ${player.name}`);

        if (playersProcessed < players.length) {
          console.log(`\n⏳ Waiting ${CONFIG.delay_between_players_ms}ms...`);
          await new Promise(r => setTimeout(r, CONFIG.delay_between_players_ms));
        }

      } catch (err) {
        console.error(`  ❌ Error processing ${player.name}:`, err);
      }
    }

    console.log(`\n🎉 SYNC COMPLETE!`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${playersProcessed} player(s)`,
        players_processed: playersProcessed,
        new_favorites_detected: newFavoritesDetected,
        matches_inserted: totalInserted,
        matches_updated: totalUpdated,
        matches_deleted: totalDeleted,
        non_favorites_cleaned: nonFavoritesCleaned,
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
