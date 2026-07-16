import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

// ─── Configuration ─────────────────────────────────────────────────────────
const CONFIG = {
  max_played_matches: 3,
  delay_between_players_ms: 1000,
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
  status: 'finished';
  score: string;
  winner: 'player' | 'opponent';
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
    const [day, month] = dateStr.replace(/\.$/, '').split('.');
    if (!day || !month) {
      console.warn(`⚠️  Invalid date format: "${dateStr}"`);
      return `${year}-01-01T12:00:00Z`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`;
  } catch (err) {
    console.error(`❌ Error parsing date "${dateStr}":`, err);
    return `${year}-01-01T12:00:00Z`;
  }
}

// ─── Scraper : Played Matches ──────────────────────────────────────────────
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
    console.log(`  📋 Total rows in table: ${allRows.length}`);

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
        console.log(`  🏆 Tournament section: ${currentTournamentSlug || 'N/A'}`);
        continue;
      }

      if (classes.includes('one') || classes.includes('two')) {
        if (matchCount >= CONFIG.max_played_matches) {
          console.log(`  ⏹️  Reached max matches (${CONFIG.max_played_matches})`);
          break;
        }

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

          if (!matchId || !opponentName || !score) {
            console.log(`  ⚠️  Incomplete match data, skipping`);
            continue;
          }

          console.log(`  ✅ Match ${matchCount + 1}: vs ${opponentName} (${score}) - Winner: ${winner}`);

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
          console.error('  ⚠️  Error parsing match row:', err);
        }
      }
    }

    console.log(`  📊 Total played matches scraped: ${matches.length}`);

  } catch (err) {
    console.error('  ❌ Error scraping played matches:', err);
  }

  return matches;
}

// ─── Scraper : Page joueur ─────────────────────────────────────────────────
async function scrapePlayerMatches(playerSlug: string, playerName: string): Promise<Match[]> {
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

  return scrapePlayedMatches(doc, playerName);
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

  if (cached) {
    console.log(`    ✅ Opponent in cache: ${opponentName}`);
    return cached.id;
  }

  console.log(`    🔍 Searching TheSportsDB for: ${opponentName}`);

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

        console.log(`    ✅ Opponent cached from API: ${opponentName}`);
        return newCache.id;
      }
    }
  } catch (err) {
    console.log(`    ⚠️  TheSportsDB API error:`, err);
  }

  // Fallback : upsert sur name pour éviter les doublons si la fonction est relancée
  try {
    const { data: fallbackCache } = await supabase
      .from('tennis_players_cache')
      .upsert({ name: opponentName }, { onConflict: 'name' })
      .select('id')
      .single();

    console.log(`    ⚠️  Opponent cached without photos: ${opponentName}`);
    return fallbackCache.id;
  } catch (err) {
    console.log(`    ❌ Failed to cache opponent:`, err);
    return null;
  }
}

// ─── DB : Sync matches ─────────────────────────────────────────────────────
async function syncMatches(supabase: any, playerId: string, matches: Match[]) {
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
      console.log(`    ✓ Match synced: ${match.atp_match_id}`);

    } catch (err) {
      console.error(`    ❌ Error syncing match:`, err);
    }
  }

  return { created };
}

// ─── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async () => {
  try {
    console.log('🎾 Starting Played Matches Sync (MANUAL SETUP)...\n');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('HEGON_SECRET_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'sport' },
    });

    const { data: favoriteIds, error: favError } = await supabase
      .from('user_favorites')
      .select('entity_id')
      .eq('entity_type', 'tennis_player');

    if (favError) throw favError;

    if (!favoriteIds || favoriteIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No favorite players to sync', players_processed: 0 }),
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
        JSON.stringify({ success: true, message: 'No players with slugs found', players_processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${players.length} player(s) with slug(s)\n`);

    let totalMatches    = 0;
    let playersProcessed = 0;

    for (const player of players) {
      if (!player.tennis_explorer_slug) continue;

      console.log(`\n💾 Processing: ${player.name}`);

      try {
        const matches = await scrapePlayerMatches(player.tennis_explorer_slug, player.name);

        await syncMatches(supabase, player.id, matches);

        totalMatches += matches.length;
        playersProcessed++;

        console.log(`  ✅ Synced ${matches.length} played matches for ${player.name}`);

        if (playersProcessed < players.length) {
          console.log(`\n⏳ Waiting ${CONFIG.delay_between_players_ms}ms...`);
          await new Promise(r => setTimeout(r, CONFIG.delay_between_players_ms));
        }

      } catch (err) {
        console.error(`  ❌ Error processing ${player.name}:`, err);
      }
    }

    console.log(`\n🎉 PLAYED MATCHES SETUP COMPLETE!`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced played matches for ${playersProcessed} player(s)`,
        players_processed: playersProcessed,
        total_matches: totalMatches,
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
