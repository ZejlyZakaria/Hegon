/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballBestXI.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import FootballXISection from "./FootballXISection";

export default async function FootballBestXI({ userId }: { userId: string }) {
  const supabase = await createServerClient();

  const { data: bestXiData } = await supabase
    .schema("sport").from("football_best_xi")
    .select("id, formation").eq("user_id", userId).maybeSingle();

  let bestXiPlayers: any[] = [];
  if (bestXiData?.id) {
    const { data } = await supabase.schema("sport").from("football_best_xi_players")
      .select("*").eq("best_xi_id", bestXiData.id);
    bestXiPlayers = data ?? [];
  }

  return (
    <section>
      <FootballXISection
        userId={userId}
        initialFormation={bestXiData?.formation ?? "4-3-3"}
        initialPlayers={bestXiPlayers.map((p: any) => ({
          id: p.player_external_id,
          name: p.player_name,
          nationality: p.nationality,
          image_url: p.image_url,
          position_key: p.position_key,
          is_substitute: p.is_substitute,
          substitute_order: p.substitute_order,
        }))}
        bestXiId={bestXiData?.id ?? null}
      />
    </section>
  );
}