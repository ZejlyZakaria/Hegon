import { PersonSkeleton } from "@/modules/watching/components/person/PersonSkeleton";

// Same skeleton on both sides of the boundary, so nothing swaps when the page mounts.
// This file alone was not enough: on a FIRST visit the segment is not loaded yet, so Next
// fell back to the nearest boundary it already had — the grid skeleton one level up — and
// drew Don't Miss + carousels for ~0.1s on the way in. That file is gone; see GridPageSkeleton.
export default function PersonLoading() {
  return <PersonSkeleton />;
}
