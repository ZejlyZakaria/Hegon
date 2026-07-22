import { GridPageSkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";

// Its own boundary, so nothing above can stand in for it — and so it can never stand in for
// anything else. See GridPageSkeleton.
export default function AnimesLoading() {
  return <GridPageSkeleton />;
}
