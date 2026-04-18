/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentUserId } from "@/shared/utils/getCurrentUserId";
import type { F1Team } from "./types";

// =====================================================
// F1 SERVICE
// =====================================================

export async function getNextRace(): Promise<any | null> {
  const supabase = createClient();
  const { data } = await supabase
    .schema("sport")
    .from("f1_races")
    .select(`
      id,
      race_name,
      race_date,
      race_time,
      quali_date,
      quali_time,
      round,
      season,
      f1_circuits (
        circuit_name,
        locality,
        country,
        country_code,
        circuit_svg_url
      )
    `)
    .eq("status", "upcoming")
    .gte("race_date", new Date().toISOString())
    .order("race_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function getUpcomingRaces(limit: number = 3): Promise<any[]> {
  const supabase = createClient();
  const { data } = await supabase
    .schema("sport")
    .from("f1_races")
    .select(`
      id,
      race_name,
      race_date,
      race_time,
      round,
      season,
      f1_circuits (
        circuit_name,
        locality,
        country,
        country_code,
        circuit_svg_url,
        circuit_length_km,
        total_laps,
        last_winner_driver_id,
        last_winner_year,
        f1_drivers:last_winner_driver_id (
          full_name
        )
      )
    `)
    .eq("status", "upcoming")
    .gte("race_date", new Date().toISOString())
    .order("race_date", { ascending: true })
    .range(1, limit);

  return data || [];
}

export async function getRecentRaces(limit: number = 3): Promise<any[]> {
  const supabase = createClient();

  const { data: races, error: racesError } = await supabase
    .schema("sport")
    .from("f1_races")
    .select(`
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
    `)
    .eq("status", "completed")
    .lte("race_date", new Date().toISOString())
    .order("race_date", { ascending: false })
    .limit(limit);

  if (racesError || !races || races.length === 0) {
    console.error("Error fetching recent races:", racesError);
    return [];
  }

  const results = await Promise.all(
    races.map(async (race) => {
      const [podiumRes, fastestLapRes] = await Promise.all([
        supabase
          .schema("sport")
          .from("f1_results")
          .select(`
            position,
            laps,
            f1_drivers!inner (
              full_name,
              code,
              current_team_id,
              f1_teams!f1_drivers_current_team_id_fkey (
                color_primary,
                logo_url,
                name
              )
            )
          `)
          .eq("race_id", race.id)
          .in("position", [1, 2, 3])
          .order("position", { ascending: true }),
        supabase
          .schema("sport")
          .from("f1_results")
          .select(`fastest_lap_time, laps, f1_drivers!inner (code)`)
          .eq("race_id", race.id)
          .eq("fastest_lap", true)
          .single(),
      ]);

      const podiumData = podiumRes.data as any[];
      const fastestLapData = fastestLapRes.data as any;

      if (!podiumData || podiumData.length < 3) return null;

      const totalLaps =
        podiumData.find((p: any) => p.position === 1)?.laps ||
        fastestLapData?.laps ||
        0;

      return {
        id: race.id,
        race_name: race.race_name,
        race_date: race.race_date,
        round: race.round,
        season: race.season,
        f1_circuits: race.f1_circuits,
        podium: {
          p1: {
            driver_name: podiumData[0]?.f1_drivers?.full_name || "Unknown",
            team_color: podiumData[0]?.f1_drivers?.f1_teams?.color_primary || "#ef4444",
            team_logo: podiumData[0]?.f1_drivers?.f1_teams?.logo_url || null,
            team_name: podiumData[0]?.f1_drivers?.f1_teams?.name || null,
          },
          p2: { driver_name: podiumData[1]?.f1_drivers?.full_name || "Unknown" },
          p3: { driver_name: podiumData[2]?.f1_drivers?.full_name || "Unknown" },
        },
        stats: {
          total_laps: totalLaps,
          fastest_lap_time: fastestLapData?.fastest_lap_time || "-",
          fastest_lap_driver: fastestLapData?.f1_drivers?.code || "-",
        },
      };
    })
  );

  return results.filter(Boolean);
}

export async function getDriverStandings(season: number = 2026): Promise<any[]> {
  const supabase = createClient();
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
    .eq("season", season)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching driver standings:", error);
    return [];
  }

  return data || [];
}

export async function getConstructorStandings(season: number = 2026): Promise<any[]> {
  const supabase = createClient();
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
    .eq("season", season)
    .order("position", { ascending: true });

  if (error) {
    console.error("Error fetching constructor standings:", error);
    return [];
  }

  return data || [];
}

export async function getUserFavoriteTeams(): Promise<F1Team[]> {
  const supabase = createClient();
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .schema("sport")
    .from("user_favorites")
    .select(`entity_id, team:f1_teams(*)`)
    .eq("user_id", userId)
    .eq("entity_type", "f1_team");

  return data?.map((f: { team: any }) => f.team) || [];
}

// ─── Master page data ─────────────────────────────────────────────────────────

export async function getF1PageData(): Promise<any> {
  const [nextRace, upcomingRaces, recentRaces, driverStandings, constructorStandings, userFavoriteTeams] =
    await Promise.all([
      getNextRace(),
      getUpcomingRaces(3),
      getRecentRaces(3),
      getDriverStandings(2026),
      getConstructorStandings(2026),
      getUserFavoriteTeams(),
    ]);

  return {
    nextRace,
    upcomingRaces,
    recentRaces,
    driverStandings,
    constructorStandings,
    userFavoriteTeams,
  };
}
