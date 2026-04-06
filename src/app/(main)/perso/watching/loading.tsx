import { MoviesHeroSkeleton, CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";

export default function WatchingLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-2">
      <MoviesHeroSkeleton />
      <CarouselSkeleton cards={4} />
      <CarouselSkeleton cards={4} />
    </div>
  );
}
