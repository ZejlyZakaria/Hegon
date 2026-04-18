import TennisUpcomingTournaments, { type TournamentData, type PlayerInTournament } from "./TennisUpcomingTournaments";

interface Props {
  tournament: TournamentData;
  playersInTournament: PlayerInTournament[];
  isOngoing: boolean;
}

export default function TennisUpcomingSection({ tournament, playersInTournament, isOngoing }: Props) {
  const sectionTitle = isOngoing ? "Tournament in Progress" : "Next Tournament";

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-1 w-12 rounded-full bg-linear-to-r from-amber-500 to-amber-300" />
        <h2 className="text-base font-semibold text-white tracking-tight">{sectionTitle}</h2>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <TennisUpcomingTournaments
        tournament={tournament}
        playersInTournament={playersInTournament}
        isOngoing={isOngoing}
      />
    </section>
  );
}
