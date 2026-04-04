/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballRecentResults.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import { getFootballTeams, getCrestsByExternalIds } from "@/modules/sports/football/service"
import RecentResults, { type PastMatch, type FollowedTeamResult } from "./FootballRecentResults";


export default async function FootballRecentResults({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  
  // ✅ Fetch ses propres données
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams, mainTeam, otherFavoriteTeams } = teams;

  if (!allFavoriteTeamIds.length) return null;

  const { data: pastRaw } = await supabase
    .schema("sport")
    .from("football_past_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, home_score, away_score, football_competitions ( name, emblem_url )")
    .in("team_id", allFavoriteTeamIds)
    .order("match_date", { ascending: false })
    .limit(allFavoriteTeamIds.length * 3);

  if (!pastRaw?.length) return null;

  const externalIds = [...new Set([
    ...pastRaw.map((m: any) => m.home_team_external_id),
    ...pastRaw.map((m: any) => m.away_team_external_id),
  ].filter(Boolean))];
  const crestMap = await getCrestsByExternalIds(externalIds);

  const pastMatches: PastMatch[] = pastRaw
    .map((m: any) => {
      const followedTeam = allTeams[m.team_id];
      if (!followedTeam) return null;
      const comp = m.football_competitions as any;
      return {
        id: m.id,
        home_team_name: m.home_team_name,
        away_team_name: m.away_team_name,
        home_team_crest: crestMap[m.home_team_external_id] ?? null,
        away_team_crest: crestMap[m.away_team_external_id] ?? null,
        match_date: m.match_date,
        home_score: m.home_score,
        away_score: m.away_score,
        competition_name: comp?.name ?? null,
        competition_emblem_url: comp?.emblem_url ?? null,
        followed_team_id: m.team_id,
        followed_team_name: followedTeam.name,
      };
    }).filter(Boolean) as PastMatch[];

  const followedTeamResults: FollowedTeamResult[] = [
    ...(mainTeam ? [{ ...mainTeam, isMainTeam: true }] : []),
    ...otherFavoriteTeams.map(t => ({ ...t, isMainTeam: false })),
  ];

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Results</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <RecentResults matches={pastMatches} followedTeams={followedTeamResults} />
    </section>
  );
}