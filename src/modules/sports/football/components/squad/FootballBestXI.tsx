/* eslint-disable @typescript-eslint/no-explicit-any */
import FootballXISection from "./FootballXISection";

interface Props {
  userId: string;
  bestXI: { id: string | null; formation: string; players: any[] };
}

export default function FootballBestXI({ userId, bestXI }: Props) {
  return (
    <section>
      <FootballXISection
        userId={userId}
        initialFormation={bestXI.formation}
        initialPlayers={bestXI.players}
        bestXiId={bestXI.id}
      />
    </section>
  );
}