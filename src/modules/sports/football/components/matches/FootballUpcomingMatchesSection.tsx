import UpcomingMatches, { type UpcomingMatch, type FollowedTeam } from "./FootballUpcomingMatches";

interface Props {
  matches: UpcomingMatch[];
  followedTeams: FollowedTeam[];
}

export default function FootballUpcomingMatchesSection({ matches, followedTeams }: Props) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">Upcoming Matches</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <UpcomingMatches matches={matches} followedTeams={followedTeams} />
    </section>
  );
}
