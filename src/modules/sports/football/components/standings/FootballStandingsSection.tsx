import StandingsTable, { type CompetitionStandings } from "./StandingsTableInner";

interface Props {
  standings: CompetitionStandings[];
  favoriteTeamIds: string[];
}

export default function FootballStandingsSection({ standings, favoriteTeamIds }: Props) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-emerald-500 to-emerald-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">Standings</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <StandingsTable data={standings} favoriteTeamIds={favoriteTeamIds} />
    </section>
  );
}