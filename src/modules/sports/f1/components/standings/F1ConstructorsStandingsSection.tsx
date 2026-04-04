import { getConstructorStandings } from "@/modules/sports/f1/service";
import F1ConstructorsStandings from "./F1ConstructorsStandings";

export default async function F1ConstructorsStandingsSection() {
  const standings = await getConstructorStandings(2026);

  if (standings.length === 0) {
    return null;
  }

  return <F1ConstructorsStandings standings={standings} />;
}
