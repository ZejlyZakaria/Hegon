// components/watching/sections/WantToWatchSection.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import WantToWatchSectionClient from "./WantToWatchSectionClient";
import type { WatchingConfig } from "@/modules/watching/types";

export default async function WantToWatchSection({ userId, config }: { userId: string; config: WatchingConfig }) {
  const supabase = await createServerClient();

  const { data } = await supabase
    .schema("watching")
    .from("media_items")
    .select("*")
    .eq("user_id", userId)
    .eq("type", config.type)
    .eq("want_to_watch", true)
    .order("priority_level", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <WantToWatchSectionClient
      initialItems={data ?? []}
      userId={userId}
      config={config}
    />
  );
}