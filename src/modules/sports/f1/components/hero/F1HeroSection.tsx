/* eslint-disable @typescript-eslint/no-explicit-any */
import F1Hero from "./F1Hero";
import type { F1HeroData } from "./F1Hero";

interface Props {
  nextRace: any;
}

export default function F1HeroSection({ nextRace }: Props) {
  if (!nextRace) {
    return (
      <div className="p-8 text-zinc-500 text-center">
        No race is scheduled for the moment.
      </div>
    );
  }

  if (!nextRace.f1_circuits) {
    return (
      <div className="p-8 text-zinc-500 text-center">
        Circuit information not available.
      </div>
    );
  }

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

  return <F1Hero heroData={heroData} />;
}
