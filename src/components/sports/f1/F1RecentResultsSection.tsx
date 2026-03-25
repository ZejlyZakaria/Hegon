/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from "@/lib/supabase/server";
import F1RecentResults from "@/components/sports/F1RecentResults";

interface RecentResult {
  id: string;
  race_name: string;
  race_date: string;
  round: number;
  season: number;
  f1_circuits: {
    circuit_name: string;
    locality: string;
    country: string;
    country_code: string;
    circuit_svg_url: string | null;
  };
  podium: {
    p1: {
      driver_name: string;
      team_color: string;
      team_logo: string | null;
      team_name: string | null;
    };
    p2: { driver_name: string };
    p3: { driver_name: string };
  };
  stats: {
    total_laps: number;
    fastest_lap_time: string;
    fastest_lap_driver: string;
  };
}

async function getRecentResults(supabase: any) {
  // 1. Récupérer les 3 derniers GP completed
  const { data: races, error: racesError } = await supabase
    .schema("sport")
    .from("f1_races")
    .select(
      `
      id,
      race_name,
      race_date,
      round,
      season,
      f1_circuits (
        circuit_name,
        locality,
        country,
        country_code,
        circuit_svg_url
      )
    `,
    )
    .eq("status", "completed")
    .lte("race_date", new Date().toISOString())
    .order("race_date", { ascending: false })
    .limit(3);

  if (racesError || !races || races.length === 0) {
    console.error("Error fetching recent races:", racesError);
    return [];
  }

  // 2. Pour chaque course, récupérer le podium et les stats
  const results: RecentResult[] = [];

  for (const race of races) {
    // Récupérer le podium (P1, P2, P3) avec les infos des pilotes et équipe du P1
    const { data: podiumData } = await supabase
      .schema("sport")
      .from("f1_results")
      .select(
        `
        position,
        f1_drivers!inner (
          full_name,
          current_team_id,
          f1_teams!f1_drivers_current_team_id_fkey (
            color_primary,
            logo_url,
            name
          )
        )
      `,
      )
      .eq("race_id", race.id)
      .in("position", [1, 2, 3])
      .order("position", { ascending: true });

    if (!podiumData || podiumData.length < 3) {
      continue; // Skip si pas de podium complet
    }

    // Récupérer le fastest lap info
    const { data: fastestLapData } = await supabase
      .schema("sport")
      .from("f1_results")
      .select(
        `
        fastest_lap_time,
        laps,
        f1_drivers!inner (
          code
        )
      `,
      )
      .eq("race_id", race.id)
      .eq("fastest_lap", true)
      .single();

    // Récupérer total laps (du gagnant, position 1)
    const totalLaps =
      podiumData.find((p: any) => p.position === 1)?.laps ||
      fastestLapData?.laps ||
      0;

    // Construire l'objet result
    const result: RecentResult = {
      id: race.id,
      race_name: race.race_name,
      race_date: race.race_date,
      round: race.round,
      season: race.season,
      f1_circuits: race.f1_circuits,
      podium: {
        p1: {
          driver_name: podiumData[0]?.f1_drivers?.full_name || "Unknown",
          team_color:
            podiumData[0]?.f1_drivers?.f1_teams?.color_primary || "#ef4444",
          team_logo: podiumData[0]?.f1_drivers?.f1_teams?.logo_url || null,
          team_name: podiumData[0]?.f1_drivers?.f1_teams?.name || null,
        },
        p2: {
          driver_name: podiumData[1]?.f1_drivers?.full_name || "Unknown",
        },
        p3: {
          driver_name: podiumData[2]?.f1_drivers?.full_name || "Unknown",
        },
      },
      stats: {
        total_laps: totalLaps,
        fastest_lap_time: fastestLapData?.fastest_lap_time || "-",
        fastest_lap_driver: fastestLapData?.f1_drivers?.code || "-",
      },
    };

    results.push(result);
  }

  return results;
}

export default async function F1RecentResultsSection({}: { userId: string }) {
  const supabase = await createServerClient();
  const recentResults = await getRecentResults(supabase);

  if (recentResults.length === 0) {
    return null;
  }

  return <F1RecentResults results={recentResults} />;
}
