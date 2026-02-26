"use client";

import Trending from "./trending";
import Recent from "./recent";
import TopTen from "./topTen";
import RecentlyWatched from "./recentlyWatched";
import AddMediaModal from "@/components/watching/AddMediaModal";
import { useState } from "react";
import WantToWatch from "./wantToWatch";

export default function MoviesPage() {
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
          <Trending />
        </div>

        <div className="md:col-span-1 flex">
          <Recent />
        </div>
      </div>

      <div className="mt-2">
        <TopTen
          onAddClick={() => setShowAddToTopTenModal(true)}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <RecentlyWatched
        onAddClick={() => setShowAddToRecentlyWatchedModal(true)}
        refreshTrigger={refreshTrigger}
      />

      <WantToWatch
        onAddClick={() => setShowAddToWantToWatchModal(true)}
        refreshTrigger={refreshTrigger}
      />
      <AddMediaModal
        isOpen={showAddToTopTenModal}
        onClose={() => setShowAddToTopTenModal(false)}
        onAdded={refresh}
        defaultType="film"
        listContext="topTen"
      />
      <AddMediaModal
        isOpen={showAddToRecentlyWatchedModal}
        onClose={() => setShowAddToRecentlyWatchedModal(false)}
        onAdded={refresh}
        defaultType="film"
        listContext="recentlyWatched"
      />
      <AddMediaModal
        isOpen={showAddToWantToWatchModal}
        onClose={() => setShowAddToWantToWatchModal(false)}
        onAdded={refresh}
        defaultType="film"
        listContext="wantToWatch"
      />
    </section>
  );
}
