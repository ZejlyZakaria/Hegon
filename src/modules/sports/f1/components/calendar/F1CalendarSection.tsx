/* eslint-disable @typescript-eslint/no-explicit-any */
import F1Calendar from "./F1Calendar";

interface Props {
  upcomingRaces: any[];
}

export default function F1CalendarSection({ upcomingRaces }: Props) {
  if (upcomingRaces.length === 0) return null;
  return <F1Calendar races={upcomingRaces} />;
}
