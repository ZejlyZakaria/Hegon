/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/tennis/TennisUpcomingSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getTennisPlayers } from "@/lib/utils/tennis-helpers";
import TennisUpcomingTournaments from "@/components/sports/tennis/TennisUpcomingTournaments";
import type { PlayerInTournament } from "@/components/sports/tennis/TennisUpcomingTournaments";

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
    .order("match_date", { ascending: true });

  const matchByPlayer: Record<string, any> = {};
  for (const m of nextMatches ?? []) {
    if (!matchByPlayer[m.player_id]) matchByPlayer[m.player_id] = m;
  }

  const playersInTournament: PlayerInTournament[] = favoritePlayers
    .filter((p: any) => matchByPlayer[p.id])
    .map((p: any) => ({
      player: {
        id: p.id,
        name: p.name,
        photo_url: p.photo_url ?? null,
        country: p.country ?? null,
      },
      rank: rankingsMap[p.id] ?? null,
      nextMatch: matchByPlayer[p.id]
        ? {
            match_date: matchByPlayer[p.id].match_date,
            opponent_name: matchByPlayer[p.id].opponent_name ?? null,
            round: matchByPlayer[p.id].round ?? null,
          }
        : null,
    }));

  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
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