/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/tennis/TennisHeroSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getTennisPlayers } from "@/lib/utils/tennis-helpers";

import TennisHero from "@/components/sports/TennisHero";
import type { PlayerHero } from "@/components/sports/TennisHero";

async function getNextMatch(supabase: any, playerId: string) {
  const { data } = await supabase
    .schema("sport")
    .from("tennis_matches")  
    .select(`
      match_date,
      opponent_name,
      round,
      tennis_tournaments(name, surface)
    `)  // ✅ SIMPLIFIÉ
    .eq("player_id", playerId)
    .eq("status", "scheduled") 
    .gte("match_date", new Date().toISOString())  
    .order("match_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  
  return data ?? null;
}

export default async function TennisHeroSection({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();

  const players = await getTennisPlayers(userId);
  const { favoritePlayers, favoritePlayerIds, mainPlayerId } = players;

  const [rankingsRes, ...nextMatches] = await Promise.all([
    supabase.schema("sport").from("tennis_rankings")
      .select("player_id, rank")
      .in("player_id", favoritePlayers.map((p: any) => p.id)),
    ...favoritePlayers.map((p: any) => getNextMatch(supabase, p.id)),
  ]);

  const rankingsMap: Record<string, number> = {};
  for (const r of rankingsRes.data ?? []) {
    rankingsMap[r.player_id] = r.rank;
  }

  const playerHeroes: PlayerHero[] = favoritePlayers.map((player: any, i: number) => ({
    player: {
      id: player.id,
      name: player.name,
      country: player.country ?? null,
      photo_url: player.photo_url ?? null,
    },
    rank: rankingsMap[player.id] ?? null,
    isMainPlayer: player.id === mainPlayerId,
    nextMatch: nextMatches[i] as any,
  }));

  // ✅ Tri par mainPlayer puis par rank
  playerHeroes.sort((a, b) => {
    if (a.isMainPlayer !== b.isMainPlayer) {
      return b.isMainPlayer ? 1 : -1;
    }
    if (a.rank === null && b.rank === null) return 0;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });

  return (
    <TennisHero
      playerHeroes={playerHeroes}
      userId={userId}
      favoritePlayerIds={favoritePlayerIds}
    />
  );
}