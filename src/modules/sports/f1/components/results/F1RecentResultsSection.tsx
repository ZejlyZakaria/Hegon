import { getRecentRaces } from "@/modules/sports/f1/service";
import F1RecentResults from "./F1RecentResults";

export default async function F1RecentResultsSection() {
  const recentResults = await getRecentRaces(3);

  if (recentResults.length === 0) {
    return null;
  }

  return <F1RecentResults results={recentResults} />;
}
