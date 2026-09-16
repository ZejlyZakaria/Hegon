"use client";

import { useSearchParams } from "next/navigation";
import { LibrarySkeleton } from "@/modules/watching/components/shared/WatchingSkeletons";
import { PeopleViewSkeleton } from "@/modules/watching/components/library/PeopleView";

/**
 * The route's loading state reads the URL: `?view=people` reserves the People rails, not the
 * titles grid — a refresh on People used to flash the wrong skeleton first (owner, 2026-09-16).
 * A loading.tsx is a server file and cannot read search params; this client piece can.
 */
export function LibraryLoading() {
  const view = useSearchParams().get("view");
  return view === "people" ? <PeopleViewSkeleton /> : <LibrarySkeleton />;
}
