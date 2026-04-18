/* eslint-disable @typescript-eslint/no-explicit-any */
import F1DriversStandings from "./F1DriversStandings";

interface Props {
  standings: any[];
}

export default function F1DriversStandingsSection({ standings }: Props) {
  if (standings.length === 0) return null;
  return <F1DriversStandings standings={standings} />;
}
