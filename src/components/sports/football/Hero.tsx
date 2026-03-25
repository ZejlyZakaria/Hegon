"use client";
// components/sports/football/Hero.tsx

import dynamic from "next/dynamic";
import { FootballHeroSkeleton } from "@/components/sports/SportSkeletons";

export interface TeamHero {
  team: { id: string; name: string; crest_url: string | null };
  isMainTeam: boolean;
  nextMatch: {
    start_time: string;
    competition_name: string;
    home_team_name: string;
    away_team_name: string;
  } | null;
}

interface HeroProps {
  teamHeroes: TeamHero[];
  userId: string;
  favoriteTeamIds: string[];
}

const HeroSwiper = dynamic(() => import("./HeroSwiper"), {
  ssr: false,
  loading: () => <FootballHeroSkeleton />,
});

export default function Hero({ teamHeroes, userId, favoriteTeamIds }: HeroProps) {
  return (
    <HeroSwiper
      teamHeroes={teamHeroes}
      userId={userId}
      favoriteTeamIds={favoriteTeamIds}
    />
  );
}