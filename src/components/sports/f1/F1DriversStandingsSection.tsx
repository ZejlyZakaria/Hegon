/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@/lib/supabase/server";
import F1DriversStandings from "@/components/sports/F1DriversStandings";

export interface DriverStanding {
  position: number;
  driver_id: string;
  points: number;
  wins: number;
  podiums: number;
  f1_drivers: {
    full_name: string;
    code: string;
    current_team_id: string | null;
    f1_teams: {
      name: string;
      color_primary: string;
      logo_url: string | null;
    } | null;
  } | null;
}

async function getDriverStandings(supabase: any) {
  const { data, error } = await supabase
    .schema("sport")
    .from("f1_driver_standings")
    .select(`
      position,
      driver_id,
      points,
      wins,
      podiums,
      f1_drivers!inner (
        full_name,
        code,
        current_team_id,
        f1_teams!f1_drivers_current_team_id_fkey (
          name,
          color_primary,
          logo_url
        )
      )
    `)
    .eq("season", 2026)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching driver standings:", error);
    return [];
  }

  return (data as DriverStanding[]) || [];
}

export default async function F1DriversStandingsSection({
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  const standings = await getDriverStandings(supabase);

  if (standings.length === 0) {
    return null;
  }

  return <F1DriversStandings standings={standings} />;
}