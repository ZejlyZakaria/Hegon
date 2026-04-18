import TennisRankings, { type TennisRanking } from "./TennisRankings";

interface Props {
  rankings: TennisRanking[];
  favoritePlayerIds: string[];
}

export default function TennisRankingsSection({ rankings, favoritePlayerIds }: Props) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">ATP Standings</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TennisRankings rankings={rankings} favoritePlayerIds={favoritePlayerIds} />
    </section>
  );
}
