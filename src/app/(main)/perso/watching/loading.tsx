import { MoviesHeroSkeleton, CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";

export default function WatchingLoading() {
  return (
    <div className="p-6 space-y-2">
      <MoviesHeroSkeleton />
      <CarouselSkeleton cards={5} />
      <CarouselSkeleton cards={5} />
    </div>
  );
}
