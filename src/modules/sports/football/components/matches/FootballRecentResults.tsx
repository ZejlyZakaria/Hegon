/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { FootballRecentResultsSkeleton as RecentResultsSkeleton } from "../../../components/SportSkeletons";
import type { PastMatch, FollowedTeamResult } from "./RecentResultsInner";

export type { PastMatch, FollowedTeamResult };

interface RecentResultsProps {
  matches: PastMatch[];
  followedTeams: FollowedTeamResult[];
}

const RecentResultsInner = dynamic(() => import("./RecentResultsInner"), {
  ssr: false,
  loading: () => <RecentResultsSkeleton />,
});

export default function RecentResults({
  matches,
  followedTeams,
}: RecentResultsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <RecentResultsSkeleton />;

  return <RecentResultsInner matches={matches} followedTeams={followedTeams} />;
}
