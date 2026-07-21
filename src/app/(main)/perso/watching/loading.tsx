import { DontMissSkeleton, ForYouSkeleton, CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

// Mirrors WatchingPageWrapper's real order + WatchingClient's padding/spacing, so
// the route skeleton flows seamlessly into the per-section skeletons (no double
// flash, no layout shift).
export default function WatchingLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <DontMissSkeleton />
      <ForYouSkeleton />
      <CarouselSkeleton />
      <CarouselSkeleton />
      <CarouselSkeleton />
    </div>
  );
}
