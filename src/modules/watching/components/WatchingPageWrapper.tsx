// components/watching/WatchingPageWrapper.tsx
import { Suspense } from "react";
import { createServerClient } from "@/infrastructure/supabase/server"
import WatchingHero from "@/modules/watching/components/WatchingHero";
import WatchingClient from "@/modules/watching/components/WatchingClient";
import TopTenSection from "@/modules/watching/components/sections/TopTenSection";
import InProgressSection from "@/modules/watching/components/sections/InProgressSection";
import RecentlyWatchedSection from "@/modules/watching/components/sections/RecentlyWatchedSection";
import WantToWatchSection from "@/modules/watching/components/sections/WantToWatchSection";
import { MoviesHeroSkeleton, CarouselSkeleton } from "@/modules/watching/components/WatchingSkeletons";
import type { MediaType } from "@/modules/watching/types";
import { WATCHING_CONFIGS } from "@/modules/watching/lib/media-utils";

export default async function WatchingPageWrapper({ type }: { type: MediaType }) {
  const config  = WATCHING_CONFIGS[type];
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-8 text-zinc-500">Connecte-toi pour accéder à ta collection.</div>;
  }

  return (
    <WatchingClient userId={user.id} config={config}>
      {/* hero */}
      <Suspense fallback={<MoviesHeroSkeleton />}>
        <WatchingHero config={config} />
      </Suspense>

      {/* top 10 */}
      <Suspense fallback={<CarouselSkeleton />}>
        <TopTenSection userId={user.id} config={config} />
      </Suspense>

      {/* en cours — séries et animes uniquement */}
      {config.hasInProgress && (
        <Suspense fallback={<CarouselSkeleton />}>
          <InProgressSection userId={user.id} config={config} />
        </Suspense>
      )}

      {/* vu récemment */}
      <Suspense fallback={<CarouselSkeleton />}>
        <RecentlyWatchedSection userId={user.id} config={config} />
      </Suspense>

      {/* à voir */}
      <Suspense fallback={<CarouselSkeleton />}>
        <WantToWatchSection userId={user.id} config={config} />
      </Suspense>
    </WatchingClient>
  );
}