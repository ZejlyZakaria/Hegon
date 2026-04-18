/* eslint-disable @typescript-eslint/no-explicit-any */
import F1RecentResults from "./F1RecentResults";

interface Props {
  recentRaces: any[];
}

export default function F1RecentResultsSection({ recentRaces }: Props) {
  if (recentRaces.length === 0) return null;
  return <F1RecentResults results={recentRaces} />;
}
