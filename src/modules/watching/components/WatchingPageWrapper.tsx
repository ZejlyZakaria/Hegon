"use client";

import WatchingClient from "@/modules/watching/components/WatchingClient";
import DontMissSectionClient from "./sections/DontMissSectionClient";
import ForYouSectionClient from "./sections/ForYouSectionClient";
import InProgressSectionClient from "./sections/InProgressSectionClient";
import RecentlyWatchedSectionClient from "./sections/RecentlyWatchedSectionClient";
import WantToWatchSectionClient from "./sections/WantToWatchSectionClient";
import TopTenSectionClient from "./sections/TopTenSectionClient";
import MyThemesSectionClient from "./sections/MyThemesSectionClient";
import { WATCHING_CONFIGS } from "@/modules/watching/lib/media-utils";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import type { MediaType } from "@/modules/watching/types";

export default function WatchingPageWrapper({ type }: { type: MediaType }) {
  const config = WATCHING_CONFIGS[type];
  const userId = useCurrentUserId();

  if (!userId) return null;

  return (
    <WatchingClient config={config}>
      <DontMissSectionClient config={config} />
      <ForYouSectionClient userId={userId} config={config} />
      {config.hasInProgress && <InProgressSectionClient userId={userId} config={config} />}
      <RecentlyWatchedSectionClient userId={userId} config={config} />
      {config.type === "anime" && <MyThemesSectionClient />}
      <WantToWatchSectionClient userId={userId} config={config} />
      <TopTenSectionClient userId={userId} config={config} />
    </WatchingClient>
  );
}