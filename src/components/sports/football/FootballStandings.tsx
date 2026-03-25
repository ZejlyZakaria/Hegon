/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballStandings.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getFootballTeams } from "@/lib/utils/football-helpers";
import StandingsTable, { type CompetitionStandings, type Standing } from "@/components/sports/football/StandingsTable";

const COMPETITION_ORDER = ["PD", "PL", "CL"];

export default async function FootballStandings({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  
  // ✅ Fetch ses propres données
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds } = teams;

  const [{ data: competitions }, { data: allStandingsRaw }] = await Promise.all([
    supabase.schema("sport").from("football_competitions").select("id, name, code, emblem_url"),
    supabase.schema("sport").from("football_standings")
      .select("team_id, competition_id, played_games, won, draw, lost, points, goals_for, goals_against, goal_difference, football_teams ( name, crest_url )"),
  ]);

  const allStandings: Standing[] = (allStandingsRaw ?? []).map((s: any) => ({
    ...s,
    football_teams: Array.isArray(s.football_teams)
      ? (s.football_teams[0] ?? null)
      : (s.football_teams ?? null),
  }));

  const standingsData: CompetitionStandings[] = (competitions ?? [])
    .sort((a: any, b: any) => COMPETITION_ORDER.indexOf(a.code) - COMPETITION_ORDER.indexOf(b.code))
    .map((comp: any) => ({
      competition: comp,
      standings: allStandings.filter(s => s.competition_id === comp.id),
    }))
    .filter(c => c.standings.length > 0);

  if (!standingsData.length) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Classements</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <StandingsTable data={standingsData} favoriteTeamIds={allFavoriteTeamIds} />
    </section>
  );
}