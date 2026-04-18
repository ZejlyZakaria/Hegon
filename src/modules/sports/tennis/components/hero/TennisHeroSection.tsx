import TennisHero from "./TennisHero";
import type { PlayerHero } from "./TennisHero";

interface Props {
  playerHeroes: PlayerHero[];
  userId: string;
  favoritePlayerIds: string[];
}

export default function TennisHeroSection({ playerHeroes, userId, favoritePlayerIds }: Props) {
  return (
    <TennisHero
      playerHeroes={playerHeroes}
      userId={userId}
      favoritePlayerIds={favoritePlayerIds}
    />
  );
}