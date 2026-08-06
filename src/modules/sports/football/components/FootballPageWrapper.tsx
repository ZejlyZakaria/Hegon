"use client";

import { useFootballData } from "@/modules/sports/football/hooks/useFootball";
import FollowingStrip from "./following/FollowingStrip";
import FootballUpcomingMatchesSection from "./matches/FootballUpcomingMatchesSection";
import FootballRecentResultsSection from "./matches/FootballRecentResultsSection";
import FootballStandingsSection from "./standings/FootballStandingsSection";
import FootballBestXI from "./squad/FootballBestXI";
import { FootballMatchPanel } from "./match/FootballMatchPanel";
import { FootballTeamPanel } from "./team/FootballTeamPanel";
import {
  FootballRecentResultsSkeleton,
  FootballUpcomingSkeleton,
  FootballStandingsSkeleton,
  FootballBestXISkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function FootballPageWrapper() {
  const { data, isLoading } = useFootballData();

  return (
    <div className="p-6 space-y-4">
      {/* Following strip — loads on its own hooks, independent of the page monolith. */}
      <FollowingStrip />

      {/* Team Panel — rendered once; a Following card opens it via the store (portal to <body>). */}
      <FootballTeamPanel />

      {isLoading || !data ? (
        <>
          <FootballUpcomingSkeleton />
          <FootballRecentResultsSkeleton />
          <FootballStandingsSkeleton />
          <FootballBestXISkeleton />
        </>
      ) : (
        <>
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

          {/* Rendered once — any match card opens it via the store (portal to <body>). */}
          <FootballMatchPanel />
        </>
      )}
    </div>
  );
}
