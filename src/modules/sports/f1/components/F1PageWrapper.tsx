"use client";

import { useF1Data } from "@/modules/sports/f1/hooks/useF1";
import F1HeroSection from "./hero/F1HeroSection";
import F1CalendarSection from "./calendar/F1CalendarSection";
import F1RecentResultsSection from "./results/F1RecentResultsSection";
import F1DriversStandingsSection from "./standings/F1DriversStandingsSection";
import F1ConstructorsStandingsSection from "./standings/F1ConstructorsStandingsSection";
import F1ConstructorsStandingsSkeleton, {
  F1HeroSkeleton,
  F1CalendarSkeleton,
  F1RecentResultsSkeleton,
  F1DriversStandingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function F1PageWrapper() {
  const { data, isLoading } = useF1Data();

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <F1HeroSkeleton />
        <F1CalendarSkeleton />
        <F1RecentResultsSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <F1DriversStandingsSkeleton />
          <F1ConstructorsStandingsSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <F1HeroSection nextRace={data.nextRace} />
      <F1CalendarSection upcomingRaces={data.upcomingRaces} />
      <F1RecentResultsSection recentRaces={data.recentRaces} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <F1DriversStandingsSection standings={data.driverStandings} />
        <F1ConstructorsStandingsSection standings={data.constructorStandings} />
      </div>
    </div>
  );
}
