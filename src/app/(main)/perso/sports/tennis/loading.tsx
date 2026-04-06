import {
  TennisHeroSkeleton,
  TennisUpcomingSkeleton,
  TennisRecentResultsSkeleton,
  TennisRankingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function TennisLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <TennisHeroSkeleton />
      <TennisUpcomingSkeleton />
      <TennisRecentResultsSkeleton />
      <TennisRankingsSkeleton />
    </div>
  );
}
