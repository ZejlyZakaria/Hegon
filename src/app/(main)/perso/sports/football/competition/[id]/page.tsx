import FootballCompetitionPage from "@/modules/sports/football/components/competition/FootballCompetitionPage";

export default async function CompetitionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FootballCompetitionPage id={id} />;
}
