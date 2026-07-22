import { StatsSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

// Same skeleton on both sides of the boundary, so nothing swaps when the page mounts.
// (There is no longer a parent watching/loading.tsx to fall back to — see GridPageSkeleton.)
export default function StatsLoading() {
  return <StatsSkeleton />;
}
