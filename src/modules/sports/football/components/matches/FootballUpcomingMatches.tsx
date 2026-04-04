/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { FootballUpcomingSkeleton as UpcomingMatchesSkeleton } from "../../../components/SportSkeletons";
import type { UpcomingMatch, FollowedTeam } from "./UpcomingMatchesInner";

export type { UpcomingMatch, FollowedTeam };

interface UpcomingMatchesProps {
  matches: UpcomingMatch[];
  followedTeams: FollowedTeam[];
}

const UpcomingMatchesInner = dynamic(() => import("./UpcomingMatchesInner"), {
  ssr: false,
  loading: () => <UpcomingMatchesSkeleton />,
});

export default function UpcomingMatches({
  matches,
  followedTeams,
}: UpcomingMatchesProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <UpcomingMatchesSkeleton />;

  return (
    <UpcomingMatchesInner matches={matches} followedTeams={followedTeams} />
  );
}
