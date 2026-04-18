import RecentResults, { type PastMatch, type FollowedTeamResult } from "./FootballRecentResults";

interface Props {
  matches: PastMatch[];
  followedTeams: FollowedTeamResult[];
}

export default function FootballRecentResultsSection({ matches, followedTeams }: Props) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">Recent Results</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <RecentResults matches={matches} followedTeams={followedTeams} />
    </section>
  );
}
