"use client";

import { useFootballData } from "@/modules/sports/football/hooks/useFootball";
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

export default function FootballPageWrapper() {
  const { data, isLoading } = useFootballData();

  if (isLoading || !data) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <FootballHeroSkeleton />
        <FootballUpcomingSkeleton />
        <FootballRecentResultsSkeleton />
        <FootballStandingsSkeleton />
        <FootballBestXISkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <FootballHeroSection
        teamHeroes={data.teamHeroes}
        userId={data.userId}
        favoriteTeamIds={data.favoriteTeamIds}
      />

      {data.upcomingMatches.length > 0 && (
        <FootballUpcomingMatchesSection
          matches={data.upcomingMatches}
          followedTeams={data.followedTeams}
        />
      )}

      {data.recentMatches.length > 0 && (
        <FootballRecentResultsSection
          matches={data.recentMatches}
          followedTeams={data.followedTeamResults}
        />
      )}

      {data.standings.length > 0 && (
        <FootballStandingsSection
          standings={data.standings}
          favoriteTeamIds={data.favoriteTeamIds}
        />
      )}

      <FootballBestXI
        userId={data.userId}
        bestXI={data.bestXI}
      />
    </div>
  );
}
