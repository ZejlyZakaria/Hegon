// app/perso/watching/library/page.tsx
import { createServerClient } from "@/infrastructure/supabase/server";
import LibraryClient from "@/modules/watching/components/library/LibraryClient";
import type { WatchingMedia } from "@/modules/watching/types";

export default async function LibraryPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-zinc-500">Sign in to access your library.</div>;
  }

  // Same trimmed column set as getLibraryMedia (the live query that re-seeds this).
  // Everything engaged with — seen, seeing, or dropped (reference stubs are excluded
  // since their flags are all false).
  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("id, type, title, original_title, poster_url, favorite, year, user_rating, watched_at, updated_at, tags, watched, in_progress, dropped, drop_reason, current_season, current_episode")
    .eq("user_id", user.id)
    .or("watched.eq.true,in_progress.eq.true,dropped.eq.true")
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6">
      <LibraryClient initialItems={(data ?? []) as unknown as WatchingMedia[]} userId={user.id} />
    </div>
  );
}