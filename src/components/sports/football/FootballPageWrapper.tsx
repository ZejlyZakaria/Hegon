// components/sports/football/FootballPageWrapper.tsx
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import FootballHero from "@/components/sports/football/FootballHero";
import FootballRecentResults from "@/components/sports/football/FootballRecentResults";
import FootballUpcomingMatches from "@/components/sports/football/FootballUpcomingMatches";
import FootballStandings from "@/components/sports/football/FootballStandings";
import FootballBestXI from "@/components/sports/football/FootballBestXI";
import {
  FootballHeroSkeleton,
  FootballRecentResultsSkeleton,
  FootballUpcomingSkeleton,
  FootballStandingsSkeleton,
  FootballBestXISkeleton,
} from "@/components/sports/SportSkeletons";

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

  // ✅ Plus de getFootballTeams() ici - chaque section fetch ses propres données
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Suspense fallback={<FootballHeroSkeleton />}>
        <FootballHero userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballUpcomingSkeleton />}>
        <FootballUpcomingMatches userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballRecentResultsSkeleton />}>
        <FootballRecentResults userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballStandingsSkeleton />}>
        <FootballStandings userId={user.id} />
      </Suspense>

      <Suspense fallback={<FootballBestXISkeleton />}>
        <FootballBestXI userId={user.id} />
      </Suspense>
    </div>
  );
}
