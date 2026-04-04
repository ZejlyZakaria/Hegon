import { getUpcomingRaces } from "@/modules/sports/f1/service";
import F1Calendar from "./F1Calendar";

export default async function F1CalendarSection() {
  const upcomingRaces = await getUpcomingRaces(3);

  if (upcomingRaces.length === 0) {
    return null;
  }

  return <F1Calendar races={upcomingRaces} />;
}
