import FootballTeamPage from "@/modules/sports/football/components/team/FootballTeamPage";

export default async function TeamRoute({ params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  return <FootballTeamPage externalId={externalId} />;
}
