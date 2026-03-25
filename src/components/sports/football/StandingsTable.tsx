/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { FootballStandingsSkeleton as StandingsTableSkeleton } from "../SportSkeletons";
import type { CompetitionStandings, Standing } from "./StandingsTableInner";

export type { CompetitionStandings, Standing };

interface StandingsTableProps {
  data: CompetitionStandings[];
  favoriteTeamIds: string[];
}

const StandingsTableInner = dynamic(() => import("./StandingsTableInner"), {
  ssr: false,
  loading: () => <StandingsTableSkeleton />,
});

export default function StandingsTable({
  data,
  favoriteTeamIds,
}: StandingsTableProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <StandingsTableSkeleton />;

  return <StandingsTableInner data={data} favoriteTeamIds={favoriteTeamIds} />;
}
