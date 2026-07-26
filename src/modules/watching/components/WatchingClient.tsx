"use client";

import { useState, createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";

import { QuickAddPanel } from "@/modules/watching/components/shared/QuickAddPanel";
import type { WatchingConfig, MediaType, ListType } from "@/modules/watching/types";

// ─── types ────────────────────────────────────────────────────────────────────

type ListContext = "topTen" | "inProgress" | "recentlyWatched" | "wantToWatch";

interface WatchingContextValue {
  /** A section "+" — opens the quick-add panel, scoped to that section (Top 10 = finder). */
  openModal: (ctx: ListContext) => void;
  /** A specific unowned title (a recommendation) — opens on its own discover page. */
  openTitle: (item: { id: number }) => void;
  config: WatchingConfig;
}

export const WatchingContext = createContext<WatchingContextValue>({
  openModal: () => {},
  openTitle: () => {},
  config: {} as WatchingConfig,
});

export const useWatching = () => useContext(WatchingContext);

// ─── main ─────────────────────────────────────────────────────────────────────

interface Props {
  config: WatchingConfig;
  children: React.ReactNode;
}

export default function WatchingClient({ config, children }: Props) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ListContext | null>(null);

  const openModal = useCallback((ctx: ListContext) => setActiveModal(ctx), []);

  // A recommendation is a title you don't own — its home is its discover page, where the add buttons
  // live. There is no add modal any more: search-adds go through the quick-add panel, and a specific
  // pre-known title goes straight to its own page.
  const openTitle = useCallback(
    (item: { id: number }) => router.push(`/perso/watching/discover/${config.type}/${item.id}`),
    [router, config.type],
  );

  const isTopTen = activeModal === "topTen";

  return (
    <WatchingContext.Provider value={{ openModal, openTitle, config }}>
      <section className="p-4 sm:p-6 space-y-4">
        {children}
      </section>

      <QuickAddPanel
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        defaultList={(activeModal && !isTopTen ? activeModal : "wantToWatch") as ListType}
        mediaType={config.type as MediaType}
        navigate={isTopTen}
        title={isTopTen ? "Add to your Top 10" : "Add to your library"}
      />
    </WatchingContext.Provider>
  );
}
