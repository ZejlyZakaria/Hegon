import {
  FootballHeroSkeleton,
  FootballUpcomingSkeleton,
  FootballRecentResultsSkeleton,
  FootballStandingsSkeleton,
  FootballBestXISkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function FootballLoading() {
  return (
    <div className="p-6 space-y-4">
      <FootballHeroSkeleton />
      <FootballUpcomingSkeleton />
      <FootballRecentResultsSkeleton />
      <FootballStandingsSkeleton />
      <FootballBestXISkeleton />
    </div>
  );
}
