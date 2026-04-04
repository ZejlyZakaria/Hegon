// components/watching/sections/TopTenSection.tsx
import { createServerClient } from "@/infrastructure/supabase/server"
import TopTenSectionClient from "./TopTenSectionClient";
import type { WatchingConfig } from "@/modules/watching/types";

export default async function TopTenSection({
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
    .eq("favorite", true)
    .not("priority", "is", null)
    .order("priority", { ascending: true })
    .limit(10);

  return (
    <div>
      <TopTenSectionClient
        initialItems={data ?? []}
        userId={userId}
        config={config}
      />
    </div>
  );
}
