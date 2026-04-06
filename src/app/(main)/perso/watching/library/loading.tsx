import { LibrarySkeleton } from "@/modules/watching/components/WatchingSkeletons";

export default function LibraryLoading() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <LibrarySkeleton />
    </div>
  );
}
