/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/f1/F1HeroSection.tsx
import { createServerClient } from "@/lib/supabase/server";
import F1Hero from "@/components/sports/F1Hero";
import type { F1HeroData } from "@/components/sports/F1Hero";

async function getNextRace(supabase: any) {
  const { data } = await supabase
    .schema("sport")
    .from("f1_races")
    .select(
      `
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
    `,
    )
    .eq("status", "upcoming")
    .gte("race_date", new Date().toISOString())
    .order("race_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export default async function F1HeroSection({}: { userId: string }) {
  const supabase = await createServerClient();

  const nextRace = await getNextRace(supabase);

  if (!nextRace) {
    return (
      <div className="p-8 text-zinc-500 text-center">
        Aucune course à venir pour le moment.
      </div>
    );
  }

  // Construire l'objet heroData
  const heroData: F1HeroData = {
    race: {
      id: nextRace.id,
      name: nextRace.race_name,
      round: nextRace.round,
      season: nextRace.season,
      raceDate: nextRace.race_date,
      raceTime: nextRace.race_time,
      qualiDate: nextRace.quali_date,
      qualiTime: nextRace.quali_time,
    },
    circuit: {
      name: nextRace.f1_circuits.circuit_name,
      locality: nextRace.f1_circuits.locality,
      country: nextRace.f1_circuits.country,
      countryCode: nextRace.f1_circuits.country_code,
      svgUrl: nextRace.f1_circuits.circuit_svg_url,
    },
  };

  // ✅ Ne plus passer userId car non utilisé
  return <F1Hero heroData={heroData} />;
}
