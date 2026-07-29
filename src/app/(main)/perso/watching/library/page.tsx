// app/perso/watching/library/page.tsx
import { createServerClient } from "@/infrastructure/supabase/server";
import LibraryClient from "@/modules/watching/components/library/LibraryClient";
import { LIBRARY_COLUMNS } from "@/modules/watching/service";
import type { WatchingMedia } from "@/modules/watching/types";

export default async function LibraryPage() {
  const supabase = await createServerClient();
  // Local JWT verification — the middleware already did it for this request. See lists/page.tsx
  // for the measurement (78.5ms of network against 0.47ms local).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  if (!userId) {
    return <div className="p-8 text-zinc-500">Sign in to access your library.</div>;
  }

  // The very column set getLibraryMedia uses — the live query that re-seeds this — imported rather
  // than retyped, so the two can no longer drift apart. Everything engaged with: seen, seeing,
  // paused, or dropped (reference stubs are excluded since their flags are all false).
  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select(LIBRARY_COLUMNS)
    .eq("user_id", userId)
    .or("watched.eq.true,in_progress.eq.true,dropped.eq.true,paused.eq.true")
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6">
      <LibraryClient initialItems={(data ?? []) as unknown as WatchingMedia[]} userId={userId} />
    </div>
  );
}