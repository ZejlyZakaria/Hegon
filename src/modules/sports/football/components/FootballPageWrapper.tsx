"use client";

import FollowingStrip from "./following/FollowingStrip";
import FootballUpcomingSection from "./matches/FootballUpcomingSection";
import FootballRecentSection from "./matches/FootballRecentSection";
import FootballStandings from "./standings/FootballStandings";
import { FootballMatchPanel } from "./match/FootballMatchPanel";

// Main page — independent sections, each loading on its own hooks (DB). Fan Log + Best XI/Legends are
// parked (they'll live on the future stats surface), so the home stays focused on "what's happening".
export default function FootballPageWrapper() {
  return (
    <div className="p-6 space-y-6">
      <FollowingStrip />
      <FootballUpcomingSection />
      <FootballRecentSection />
      <FootballStandings />

      {/* Rendered once — any match card (any section) opens it via the store (portal to <body>). */}
      <FootballMatchPanel />
    </div>
  );
}
