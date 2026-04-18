/* eslint-disable @typescript-eslint/no-explicit-any */
import F1ConstructorsStandings from "./F1ConstructorsStandings";

interface Props {
  standings: any[];
}

export default function F1ConstructorsStandingsSection({ standings }: Props) {
  if (standings.length === 0) return null;
  return <F1ConstructorsStandings standings={standings} />;
}
