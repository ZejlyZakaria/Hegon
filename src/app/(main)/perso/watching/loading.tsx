import { DontMissSkeleton, CarouselSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

export default function WatchingLoading() {
  return (
    <div className="p-6 space-y-2">
      <DontMissSkeleton />
      <CarouselSkeleton cards={5} />
      <CarouselSkeleton cards={5} />
      <CarouselSkeleton cards={5} />
    </div>
  );
}
