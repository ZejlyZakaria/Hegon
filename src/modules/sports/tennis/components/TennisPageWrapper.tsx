"use client";

import { useTennisData } from "@/modules/sports/tennis/hooks/useTennis";
import TennisHeroSection from "./hero/TennisHeroSection";
import TennisUpcomingSection from "./matches/TennisUpcomingSection";
import TennisRecentResultsSection from "./matches/TennisRecentResultsSection";
import TennisRankingsSection from "./rankings/TennisRankingsSection";
import {
  TennisRecentResultsSkeleton,
  TennisRankingsSkeleton,
  TennisHeroSkeleton,
  TennisUpcomingSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function TennisPageWrapper() {
  const { data, isLoading } = useTennisData();

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <TennisHeroSkeleton />
        <TennisUpcomingSkeleton />
        <TennisRecentResultsSkeleton />
        <TennisRankingsSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <TennisHeroSection
        playerHeroes={data.playerHeroes}
        userId={data.userId}
        favoritePlayerIds={data.favoritePlayerIds}
      />

      {data.tournament && (
        <TennisUpcomingSection
          tournament={data.tournament}
          playersInTournament={data.playersInTournament}
          isOngoing={data.isOngoing}
        />
      )}

      {data.recentMatches.length > 0 && (
        <TennisRecentResultsSection
          matches={data.recentMatches}
          followedPlayers={data.followedPlayers}
        />
      )}

      {data.rankings.length > 0 && (
        <TennisRankingsSection
          rankings={data.rankings}
          favoritePlayerIds={data.favoritePlayerIds}
        />
      )}
    </div>
  );
}
