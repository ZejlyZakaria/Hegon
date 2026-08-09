"use client";

import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useBestXI } from "@/modules/sports/football/hooks/useFootball";
import FollowingStrip from "./following/FollowingStrip";
import FootballUpcomingSection from "./matches/FootballUpcomingSection";
import FootballRecentSection from "./matches/FootballRecentSection";
import FootballStandings from "./standings/FootballStandings";
import FootballFanLog from "./fanlog/FootballFanLog";
import FootballBestXI from "./squad/FootballBestXI";
import { FootballMatchPanel } from "./match/FootballMatchPanel";
import { FootballBestXISkeleton } from "@/modules/sports/components/SportSkeletons";

export default function FootballPageWrapper() {
  const userId = useCurrentUserId();
  const { data, isLoading } = useBestXI(userId);

  return (
    <div className="p-6 space-y-4">
      {/* Independent sections — each loads on its own hooks (DB), no page monolith. */}
      <FollowingStrip />
      <FootballUpcomingSection />
      <FootballRecentSection />
      <FootballStandings />
      <FootballFanLog />

      {/* Best XI — its own small query (2 tables), no page monolith. */}
      {!userId || isLoading || !data ? (
        <FootballBestXISkeleton />
      ) : (
        <FootballBestXI userId={userId} bestXI={data} />
      )}

      {/* Rendered once — any match card (any section) opens it via the store (portal to <body>). */}
      <FootballMatchPanel />
    </div>
  );
}
