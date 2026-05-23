import { DontMissSkeleton } from "@/modules/watching/components/sections/DontMissSectionClient";
import { CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";

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
