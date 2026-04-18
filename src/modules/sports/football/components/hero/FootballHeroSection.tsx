import Hero from "./FootballHero";
import type { TeamHero } from "./FootballHero";

interface Props {
  teamHeroes: TeamHero[];
  userId: string;
  favoriteTeamIds: string[];
}

export default function FootballHeroSection({ teamHeroes, userId, favoriteTeamIds }: Props) {
  return (
    <Hero
      teamHeroes={teamHeroes}
      userId={userId}
      favoriteTeamIds={favoriteTeamIds}
    />
  );
}
