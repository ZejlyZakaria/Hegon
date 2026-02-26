"use client";

import { useState } from "react";
import RecentBase from "../tv-shows/recent";
import TrendingBase from "../tv-shows/trending";
import TopTenBase from "../tv-shows/topTen";
import AddMediaModal from "@/components/watching/AddMediaModal";
import RecentlyWatchedBase from "../tv-shows/recentlyWatched";
import WantToWatchBase from "../tv-shows/wantToWatch";

export default function Page() {
  const [showAddToTopTenModal, setShowAddToTopTenModal] = useState(false);
  const [showAddToRecentlyWatchedModal, setShowAddToRecentlyWatchedModal] =
    useState(false);
  const [showAddToWantToWatchModal, setShowAddToWantToWatchModal] =
    useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = () => setRefreshTrigger((prev) => prev + 1);
  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch min-h-[50vh]">
        <div className="md:col-span-2 flex">
          <TrendingBase variant="anime" />
        </div>
        <div className="md:col-span-1 flex">
          <RecentBase
            title="Recent Anime"
            extraQuery="with_genres=16&with_origin_country=JP"
          />
        </div>
      </div>
      <div className="mt-2">
        <TopTenBase
          variant="anime"
          onAddClick={() => setShowAddToTopTenModal(true)}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <RecentlyWatchedBase
        variant="anime"
        onAddClick={() => setShowAddToRecentlyWatchedModal(true)}
        refreshTrigger={refreshTrigger}
      />
      <WantToWatchBase
        variant="anime"
        onAddClick={() => setShowAddToWantToWatchModal(true)}
        refreshTrigger={refreshTrigger}
      />
      <AddMediaModal
        isOpen={showAddToTopTenModal}
        onClose={() => setShowAddToTopTenModal(false)}
        onAdded={refresh}
        defaultType="anime"
        listContext="topTen"
      />
      <AddMediaModal
        isOpen={showAddToRecentlyWatchedModal}
        onClose={() => setShowAddToRecentlyWatchedModal(false)}
        onAdded={refresh}
        defaultType="anime"
        listContext="recentlyWatched"
      />
      <AddMediaModal
        isOpen={showAddToWantToWatchModal}
        onClose={() => setShowAddToWantToWatchModal(false)}
        onAdded={refresh}
        defaultType="anime"
        listContext="wantToWatch"
      />
    </section>
  );
}
