/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/tennis/TennisUpcomingSection.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import { getTennisPlayers } from "@/modules/sports/tennis/service"
import TennisUpcomingTournaments from "./TennisUpcomingTournaments";
import type { PlayerInTournament } from "./TennisUpcomingTournaments";

export default async function TennisUpcomingSection({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();

  const players = await getTennisPlayers(userId);
  const { favoritePlayers, favoritePlayerIds } = players;
  const now = new Date().toISOString();

  // prochain tournoi — en cours ou à venir
  const { data: tournament } = await supabase
    .schema("sport")
    .from("tennis_tournaments")
    .select("id, name, surface, start_date, end_date, country, level")  // ✅ level au lieu de category
    .or(`start_date.gt.${now},and(start_date.lte.${now},end_date.gte.${now})`)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!tournament) return null;

  const isOngoing = tournament.start_date <= now && (!tournament.end_date || tournament.end_date >= now);
  const sectionTitle = isOngoing ? "Tournament in Progress" : "Next Tournament";

  // rankings des joueurs favoris
  const rankingsMap: Record<string, number> = {};
  if (favoritePlayerIds.length) {
    const { data: rankings } = await supabase
      .schema("sport")
      .from("tennis_rankings")
      .select("player_id, rank")
      .in("player_id", favoritePlayerIds);
    for (const r of rankings ?? []) {
      rankingsMap[r.player_id] = r.rank;
    }
  }

  // next matches des joueurs favoris dans ce tournoi
  const { data: nextMatches } = await supabase
    .schema("sport")
    .from("tennis_matches")
    .select("player_id, tournament_id, match_date, opponent_name, round")
    .in("player_id", favoritePlayerIds)
    .eq("tournament_id", tournament.id)
    .eq("status", "scheduled")
    .gt("match_date", now)
    .order("match_date", { ascending: true });

  const matchByPlayer: Record<string, any> = {};
  for (const m of nextMatches ?? []) {
    if (!matchByPlayer[m.player_id]) matchByPlayer[m.player_id] = m;
  }

  // Map favorite players by id for quick lookup
  const favoriteById = new Map(favoritePlayers.map((p: any) => [p.id, p]));

  // Detect favorites duels: two favorites scheduled at the same match_date
  // Build a signature (sorted ids) to avoid showing the same duel twice
  const processedDuelKeys = new Set<string>();

  const playersInTournament: PlayerInTournament[] = [];

  for (const p of favoritePlayers as any[]) {
    const match = matchByPlayer[p.id];
    if (!match) continue;

    // Check if the opponent is also a favorite (same match_date in the same tournament)
    const opponentFavorite = (favoritePlayers as any[]).find(
      (fp: any) =>
        fp.id !== p.id &&
        matchByPlayer[fp.id]?.match_date === match.match_date
    );

    if (opponentFavorite) {
      // Favorites duel — deduplicate using a sorted pair key
      const duelKey = [p.id, opponentFavorite.id].sort().join(":");
      if (processedDuelKeys.has(duelKey)) continue;
      processedDuelKeys.add(duelKey);

      // Show the better-ranked player as primary
      const rankA = rankingsMap[p.id] ?? 9999;
      const rankB = rankingsMap[opponentFavorite.id] ?? 9999;
      const primary = rankA <= rankB ? p : opponentFavorite;
      const secondary = rankA <= rankB ? opponentFavorite : p;

      playersInTournament.push({
        player: {
          id: primary.id,
          name: primary.name,
          photo_url: primary.photo_url ?? null,
          country: primary.country ?? null,
        },
        rank: rankingsMap[primary.id] ?? null,
        nextMatch: {
          match_date: match.match_date,
          opponent_name: secondary.name,
          opponent_photo_url: secondary.photo_url ?? null,
          round: match.round ?? null,
        },
      });
    } else {
      // Normal case — opponent is not a favorite
      playersInTournament.push({
        player: {
          id: p.id,
          name: p.name,
          photo_url: p.photo_url ?? null,
          country: p.country ?? null,
        },
        rank: rankingsMap[p.id] ?? null,
        nextMatch: {
          match_date: match.match_date,
          opponent_name: match.opponent_name ?? null,
          opponent_photo_url: null,
          round: match.round ?? null,
        },
      });
    }
  }

  // Suppress unused variable warning
  void favoriteById;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">
          {sectionTitle}
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TennisUpcomingTournaments
        tournament={tournament}
        playersInTournament={playersInTournament}
        isOngoing={isOngoing}
      />
    </section>
  );
}