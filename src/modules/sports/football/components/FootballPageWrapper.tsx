"use client";

import { useFootballData } from "@/modules/sports/football/hooks/useFootball";
import FollowingStrip from "./following/FollowingStrip";
import FootballUpcomingSection from "./matches/FootballUpcomingSection";
import FootballRecentSection from "./matches/FootballRecentSection";
import FootballStandings from "./standings/FootballStandings";
import FootballFanLog from "./fanlog/FootballFanLog";
import FootballBestXI from "./squad/FootballBestXI";
import { FootballMatchPanel } from "./match/FootballMatchPanel";
import { FootballBestXISkeleton } from "@/modules/sports/components/SportSkeletons";

export default function FootballPageWrapper() {
  const { data, isLoading } = useFootballData();

  return (
    <div className="p-6 space-y-4">
      {/* Independent sections — each loads on its own hooks (DB), no page monolith. */}
      <FollowingStrip />
      <FootballUpcomingSection />
      <FootballRecentSection />
      <FootballStandings />
      <FootballFanLog />

      {/* Best XI — still on the shared monolith data for now. */}
      {isLoading || !data ? (
        <FootballBestXISkeleton />
      ) : (
        <FootballBestXI userId={data.userId} bestXI={data.bestXI} />
      )}

      {/* Rendered once — any match card (any section) opens it via the store (portal to <body>). */}
      <FootballMatchPanel />
    </div>
  );
}
