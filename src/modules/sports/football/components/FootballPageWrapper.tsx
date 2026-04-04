// components/sports/football/FootballPageWrapper.tsx
import { Suspense } from "react";
import { createServerClient } from "@/infrastructure/supabase/server";
import FootballHeroSection from "./hero/FootballHeroSection";
import FootballUpcomingMatchesSection from "./matches/FootballUpcomingMatchesSection";
import FootballRecentResultsSection from "./matches/FootballRecentResultsSection";
import FootballStandingsSection from "./standings/FootballStandingsSection";
import FootballBestXI from "./squad/FootballBestXI";
import {
  FootballHeroSkeleton,
  FootballRecentResultsSkeleton,
  FootballUpcomingSkeleton,
  FootballStandingsSkeleton,
  FootballBestXISkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default async function FootballPageWrapper() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-zinc-500">
        Connecte-toi pour voir ton hub Football.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Suspense fallback={<FootballHeroSkeleton />}>
        <FootballHeroSection userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballUpcomingSkeleton />}>
        <FootballUpcomingMatchesSection userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballRecentResultsSkeleton />}>
        <FootballRecentResultsSection userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballStandingsSkeleton />}>
        <FootballStandingsSection userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballBestXISkeleton />}>
        <FootballBestXI userId={user.id} />
      </Suspense>
    </div>
  );
}
