"use client";
// components/sports/TennisRecentResults.tsx

import TennisRecentResultsInner from "./TennisRecentResultsInner";
import type { TennisPastMatch, FollowedPlayer } from "./TennisRecentResultsInner";

export type { TennisPastMatch, FollowedPlayer };

interface TennisRecentResultsProps {
  matches: TennisPastMatch[];
  followedPlayers: FollowedPlayer[];
}

export default function TennisRecentResults({
  matches,
  followedPlayers,
}: TennisRecentResultsProps) {
  return <TennisRecentResultsInner matches={matches} followedPlayers={followedPlayers} />;
}