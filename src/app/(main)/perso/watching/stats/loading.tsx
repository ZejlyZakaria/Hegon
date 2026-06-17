import { StatsSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

// Without this, navigating to /stats falls back to the parent /watching/loading.tsx
// (the Don't Miss + carousels skeleton = the Movies layout) for an instant before
// the Stats page mounts. Its own loading state keeps the Stats skeleton on screen.
export default function StatsLoading() {
  return <StatsSkeleton />;
}
