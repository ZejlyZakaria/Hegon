/* eslint-disable @typescript-eslint/no-explicit-any */
// components/sports/football/FootballUpcomingMatches.tsx
import { createServerClient } from "@/lib/supabase/server";
import { getFootballTeams, getCrestsByExternalIds } from "@/lib/utils/football-helpers";
import UpcomingMatches, { type UpcomingMatch, type FollowedTeam } from "@/components/sports/football/UpcomingMatches";

export default async function FootballUpcomingMatches({
  userId,
}: {
  userId: string;
}) {
  const supabase = await createServerClient();
  
  // ✅ Fetch ses propres données
  const teams = await getFootballTeams(userId);
  const { allFavoriteTeamIds, allTeams, mainTeam, otherFavoriteTeams } = teams;

  if (!allFavoriteTeamIds.length) return null;

  const { data: upcomingRaw } = await supabase
    .schema("sport")
    .from("football_next_matches")
    .select("id, team_id, home_team_name, away_team_name, home_team_external_id, away_team_external_id, match_date, football_competitions ( name, emblem_url )")
    .in("team_id", allFavoriteTeamIds)
    .gt("match_date", new Date().toISOString())
    .order("match_date", { ascending: true });

  const externalIds = [...new Set([
    ...(upcomingRaw ?? []).map((m: any) => m.home_team_external_id),
    ...(upcomingRaw ?? []).map((m: any) => m.away_team_external_id),
  ].filter(Boolean))];
  const crestMap = await getCrestsByExternalIds(externalIds);

  const upcomingMatches: UpcomingMatch[] = (upcomingRaw ?? [])
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
        competition_name: comp?.name ?? null,
        competition_emblem_url: comp?.emblem_url ?? null,
        followed_team_id: m.team_id,
        followed_team_name: followedTeam.name,
        followed_team_crest: followedTeam.crest_url,
      };
    }).filter(Boolean) as UpcomingMatch[];

  const followedTeams: FollowedTeam[] = [
    ...(mainTeam ? [{ ...mainTeam, isMainTeam: true }] : []),
    ...otherFavoriteTeams.map(t => ({ ...t, isMainTeam: false })),
  ];

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Prochains matchs</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <UpcomingMatches matches={upcomingMatches} followedTeams={followedTeams} />
    </section>
  );
}