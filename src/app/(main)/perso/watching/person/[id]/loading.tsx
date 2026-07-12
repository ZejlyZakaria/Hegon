import { PersonSkeleton } from "@/modules/watching/components/person/PersonSkeleton";

// Without this, Next falls back to the parent watching/loading.tsx — the HOME skeleton
// (Don't Miss + carousels) — which flashed before the page mounted its own PersonSkeleton.
// Same skeleton on both sides of the boundary = no swap.
export default function PersonLoading() {
  return <PersonSkeleton />;
}
