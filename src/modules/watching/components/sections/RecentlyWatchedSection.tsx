// components/watching/sections/RecentlyWatchedSection.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import RecentlyWatchedSectionClient from "./RecentlyWatchedSectionClient";
import type { WatchingConfig } from "@/modules/watching/types";

export default async function RecentlyWatchedSection({
  userId,
  config,
}: {
  userId: string;
  config: WatchingConfig;
}) {
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", userId)
    .eq("type", config.type)
    .eq("recently_watched", true)  
    .order("watched_at", { ascending: false })
    .limit(10);

  return (
    <RecentlyWatchedSectionClient
      initialItems={data ?? []}
      userId={userId}
      config={config}
    />
  );
}