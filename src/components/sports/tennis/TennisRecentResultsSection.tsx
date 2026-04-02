/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/tennis/TennisRecentResultsSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getTennisPlayers } from "@/lib/utils/tennis-helpers";
import TennisRecentResults, {
  type TennisPastMatch,
  type FollowedPlayer,
} from "@/components/sports/TennisRecentResults";

export default async function TennisRecentResultsSection({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();

  const players = await getTennisPlayers(userId);
  const { favoritePlayers, favoritePlayerIds, mainPlayerId } = players;

  if (!favoritePlayerIds.length) return null;

  // ✅ Ajout tennis_tournaments(name) dans la query
  const { data: pastMatchesRaw } = await supabase
    .schema("sport")
    .from("tennis_matches")
    .select(
      `
      id,
      player_id,
      opponent_name,
      opponent_cache_id,
      match_date,
      score,
      winner,
      round,
      tennis_players_cache(photo_thumb_url, photo_cutout_url),
      tennis_tournaments(name)
    `,
    )
    .in("player_id", favoritePlayerIds)
    .eq("status", "finished")
    .order("match_date", { ascending: false })
    .limit(favoritePlayerIds.length * 3);

  if (!pastMatchesRaw?.length) return null;

  // ✅ Mapper avec tournament_name
  const pastMatches: TennisPastMatch[] = pastMatchesRaw.map((m: any) => {
    const result = m.winner === "player" ? "W" : "L";

    const opponentPhotoUrl =
      m.tennis_players_cache?.photo_cutout_url ??
      m.tennis_players_cache?.photo_thumb_url ??
      null;

    return {
      id: m.id,
      player_id: m.player_id,
      opponent_name: m.opponent_name,
      opponent_photo_url: opponentPhotoUrl,
      match_date: m.match_date,
      score: m.score,
      result,
      round: m.round,
      tournament_name: m.tennis_tournaments?.name ?? null, // ✅ NOUVEAU
    };
  });

  const followedPlayers: FollowedPlayer[] = favoritePlayers.map((p: any) => ({
    id: p.id,
    name: p.name,
    photo_url: p.photo_url ?? null,
    isMainPlayer: p.id === mainPlayerId,
  }));

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Last matches
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TennisRecentResults
        matches={pastMatches}
        followedPlayers={followedPlayers}
      />
    </section>
  );
}
