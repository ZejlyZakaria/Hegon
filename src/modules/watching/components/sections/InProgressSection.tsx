// components/watching/sections/InProgressSection.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import InProgressSectionClient from "./InProgressSectionClient";
import type { WatchingConfig } from "@/modules/watching/types";

export default async function InProgressSection({
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
    .eq("in_progress", true)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <InProgressSectionClient
      initialItems={data ?? []}
      userId={userId}
      config={config}
    />
  );
}
