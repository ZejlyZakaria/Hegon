"use client";

import { useState } from "react";
import AddMediaModal from "@/components/watching/AddMediaModal";
import RecentBase from "./recent";
import TrendingBase from "./trending";
import TopTenBase from "./topTen";
import RecentlyWatchedBase from "./recentlyWatched";
import WantToWatchBase from "./wantToWatch";

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
          <TrendingBase variant="tv" />
        </div>
        <div className="md:col-span-1 flex">
          <RecentBase title="Recent TV Shows" />
        </div>
      </div>
      <div className="mt-2">
        <TopTenBase
          variant="tv"
          onAddClick={() => setShowAddToTopTenModal(true)}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <RecentlyWatchedBase
        variant="tv"
        onAddClick={() => setShowAddToRecentlyWatchedModal(true)}
        refreshTrigger={refreshTrigger}
      />
      <WantToWatchBase
        variant="tv"
        onAddClick={() => setShowAddToWantToWatchModal(true)}
        refreshTrigger={refreshTrigger}
      />
      <AddMediaModal
        isOpen={showAddToTopTenModal}
        onClose={() => setShowAddToTopTenModal(false)}
        onAdded={refresh}
        defaultType="serie"
        listContext="topTen"
      />
      <AddMediaModal
        isOpen={showAddToRecentlyWatchedModal}
        onClose={() => setShowAddToRecentlyWatchedModal(false)}
        onAdded={refresh}
        defaultType="serie"
        listContext="recentlyWatched"
      />
      <AddMediaModal
        isOpen={showAddToWantToWatchModal}
        onClose={() => setShowAddToWantToWatchModal(false)}
        onAdded={refresh}
        defaultType="serie"
        listContext="wantToWatch"
      />
    </section>
  );
}
