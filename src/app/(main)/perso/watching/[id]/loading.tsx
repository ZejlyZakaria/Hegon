import { DetailSkeleton } from "@/modules/watching/components/WatchingSkeletons";

// Route-level loading boundary for the media detail page. Without it, Next falls
// back to the parent watching/loading.tsx (carousel skeleton) during navigation,
// which flashed before the page's own DetailSkeleton. Same skeleton = no swap.
export default function MediaDetailLoading() {
  return <DetailSkeleton />;
}
