import { getDriverStandings } from "@/modules/sports/f1/service";
import F1DriversStandings from "./F1DriversStandings";

export default async function F1DriversStandingsSection() {
  const standings = await getDriverStandings(2026);

  if (standings.length === 0) {
    return null;
  }

  return <F1DriversStandings standings={standings} />;
}
