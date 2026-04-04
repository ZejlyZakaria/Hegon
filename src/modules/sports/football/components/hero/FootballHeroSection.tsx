/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballHero.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import { getFootballTeams } from "@/modules/sports/football/service"
import Hero from "./FootballHero";

async function getNextMatch(supabase: any, team: any) {
  const { data } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("match_date, home_team_name, away_team_name, football_competitions ( name )")
    .or(`home_team_name.ilike.%${team.name}%,away_team_name.ilike.%${team.name}%`)
    .gt("match_date", new Date().toISOString())
    .order("match_date", { ascending: true })
    .limit(1);

  if (!data?.length) return null;
  const match = data[0];
  return {
    start_time: match.match_date,
    home_team_name: match.home_team_name,
    away_team_name: match.away_team_name,
    competition_name: match.football_competitions?.name || "",
  };
}

export default async function FootballHero({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  
  // ✅ Fetch ses propres données
  const teams = await getFootballTeams(userId);
  const { mainTeam, otherFavoriteTeams, allFavoriteTeamIds } = teams;

  const allTeams = [
    ...(mainTeam ? [{ team: mainTeam, isMainTeam: true }] : []),
    ...otherFavoriteTeams.map(t => ({ team: t, isMainTeam: false })),
  ];

  const teamHeroes = await Promise.all(
    allTeams.map(async ({ team, isMainTeam }) => ({
      team,
      isMainTeam,
      nextMatch: await getNextMatch(supabase, team),
    }))
  );

  return (
    <Hero
      teamHeroes={teamHeroes}
      userId={userId}
      favoriteTeamIds={allFavoriteTeamIds}
    />
  );
}