/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@/lib/supabase/server";
import F1ConstructorsStandings from "@/components/sports/F1ConstructorsStandings";

export interface ConstructorStanding {
  position: number;
  team_id: string;
  points: number;
  wins: number;
  podiums: number;
  f1_teams: {
    name: string;
    color_primary: string;
    logo_url: string | null;
  } | null;
}

async function getConstructorStandings(supabase: any) {
  const { data, error } = await supabase
    .schema("sport")
    .from("f1_constructor_standings")
    .select(`
      position,
      team_id,
      points,
      wins,
      podiums,
      f1_teams!inner (
        name,
        color_primary,
        logo_url
      )
    `)
    .eq("season", 2026)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching constructor standings:", error);
    return [];
  }

  return (data as ConstructorStanding[]) || [];
}

export default async function F1ConstructorsStandingsSection({
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  const standings = await getConstructorStandings(supabase);

  if (standings.length === 0) {
    return null;
  }

  return <F1ConstructorsStandings standings={standings} />;
}