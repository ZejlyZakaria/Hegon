"use client";
// components/sports/TennisRankings.tsx

import TennisRankingsInner from "./TennisRankingsInner";
import type { TennisRanking } from "./TennisRankingsInner";

export type { TennisRanking };

interface TennisRankingsProps {
  rankings: TennisRanking[];
  favoritePlayerIds: string[];
}

export default function TennisRankings({ rankings, favoritePlayerIds }: TennisRankingsProps) {
  return <TennisRankingsInner rankings={rankings} favoritePlayerIds={favoritePlayerIds} />;
}