/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/tennis/TennisRankingsSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getTennisPlayers } from "@/lib/utils/tennis-helpers";
import TennisRankings, {
  type TennisRanking,
} from "@/components/sports/TennisRankings";

export default async function TennisRankingsSection({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();

  const players = await getTennisPlayers(supabase, userId);
  const { favoritePlayerIds } = players;

  // ✅ Query avec les bonnes colonnes
  const { data: rankingsRaw } = await supabase
    .schema("sport")
    .from("tennis_rankings")
    .select(
      `
      player_id,
      rank,
      points,
      tennis_players (
        id,
        name,
        country,
        photo_thumb_url,
        photo_cutout_url
      )
    `,
    )
    .order("rank", { ascending: true })
    .limit(25);

  if (!rankingsRaw?.length) return null;

  // ✅ Mapper pour avoir la structure attendue
  const rankings: TennisRanking[] = (rankingsRaw ?? []).map((r: any) => {
    const player = Array.isArray(r.tennis_players)
      ? r.tennis_players[0]
      : r.tennis_players;

    return {
      player_id: r.player_id,
      rank: r.rank,
      ranking_points: r.points ?? null, // ✅ points → ranking_points
      tennis_players: player
        ? {
            id: player.id,
            name: player.name,
            country: player.country ?? null,
            photo_url:
              player.photo_cutout_url ?? player.photo_thumb_url ?? null, // ✅ priorité cutout > thumb
          }
        : null,
    };
  });

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Classement ATP
        </h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TennisRankings
        rankings={rankings}
        favoritePlayerIds={favoritePlayerIds}
      />
    </section>
  );
}
