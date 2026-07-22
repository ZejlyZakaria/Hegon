import { DetailSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

// Route-level boundary for the media detail page: same skeleton on both sides, so nothing
// swaps when the page mounts. (There is no longer a parent watching/loading.tsx to fall back
// to — see GridPageSkeleton.)
export default function MediaDetailLoading() {
  return <DetailSkeleton />;
}
