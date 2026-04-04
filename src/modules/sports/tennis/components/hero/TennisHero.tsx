"use client";
// components/sports/TennisHero.tsx

import TennisHeroSwiper from "./TennisHeroSwiper";
import type { PlayerHero } from "./TennisHeroSwiper";

export type { PlayerHero };

interface TennisHeroProps {
  playerHeroes: PlayerHero[];
  userId: string;
  favoritePlayerIds: string[];
}

export default function TennisHero({ playerHeroes, userId, favoritePlayerIds }: TennisHeroProps) {
  return (
    <TennisHeroSwiper
      playerHeroes={playerHeroes}
      userId={userId}
      favoritePlayerIds={favoritePlayerIds}
    />
  );
}