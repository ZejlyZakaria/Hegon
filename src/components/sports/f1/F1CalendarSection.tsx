/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/f1/F1CalendarSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import F1Calendar from "@/components/sports/F1Calendar";

interface CalendarRace {
  id: string;
  race_name: string;
  race_date: string;
  race_time: string | null;
  round: number;
  season: number;
  f1_circuits: {
    circuit_name: string;
    locality: string;
    country: string;
    country_code: string;
    circuit_svg_url: string | null;
    circuit_length_km: number | null; 
    total_laps: number | null;
    last_winner_driver_id: string | null;
    last_winner_year: number | null;
    f1_drivers: { 
      full_name: string;
    } | null;
  };
}

async function getUpcomingRaces(supabase: any) {
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
    .range(1, 3); // Skip premier (déjà dans Hero), prendre 3 suivants

  return (data as CalendarRace[]) ?? [];
}

export default async function F1CalendarSection({
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  const upcomingRaces = await getUpcomingRaces(supabase);

  if (upcomingRaces.length === 0) {
    return null; // Pas de section si pas de courses à venir
  }

  return <F1Calendar races={upcomingRaces} />;
}