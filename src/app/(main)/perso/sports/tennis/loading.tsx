import {
  TennisHeroSkeleton,
  TennisUpcomingSkeleton,
  TennisRecentResultsSkeleton,
  TennisRankingsSkeleton,
} from "@/modules/sports/components/SportSkeletons";

export default function TennisLoading() {
  return (
    <div className="p-6 space-y-4">
      <TennisHeroSkeleton />
      <TennisUpcomingSkeleton />
      <TennisRecentResultsSkeleton />
      <TennisRankingsSkeleton />
    </div>
  );
}
