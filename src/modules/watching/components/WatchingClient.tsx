"use client";

import { useState, createContext, useContext, useCallback } from "react";

import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import { QuickAddPanel } from "@/modules/watching/components/shared/QuickAddPanel";
import type { WatchingConfig, MediaType, ListType } from "@/modules/watching/types";

// ─── types ────────────────────────────────────────────────────────────────────

type ListContext = "topTen" | "inProgress" | "recentlyWatched" | "wantToWatch";

interface WatchingContextValue {
  openModal: (ctx: ListContext) => void;
  openModalWithItem: (ctx: ListContext, item: unknown) => void;
  config: WatchingConfig;
}

export const WatchingContext = createContext<WatchingContextValue>({
  openModal: () => {},
  openModalWithItem: () => {},
  config: {} as WatchingConfig,
});

export const useWatching = () => useContext(WatchingContext);

// ─── main ─────────────────────────────────────────────────────────────────────

interface Props {
  config: WatchingConfig;
  children: React.ReactNode;
}

export default function WatchingClient({ config, children }: Props) {
  const [activeModal, setActiveModal] = useState<ListContext | null>(null);
  const [pendingInitialItem, setPendingInitialItem] = useState<unknown>(null);

  const openModal = useCallback((ctx: ListContext) => {
    setPendingInitialItem(null);
    setActiveModal(ctx);
  }, []);

  const openModalWithItem = useCallback((ctx: ListContext, item: unknown) => {
    setPendingInitialItem(item);
    setActiveModal(ctx);
  }, []);

  const handleAdded = useCallback(() => {
    setActiveModal(null);
    setPendingInitialItem(null);
  }, []);

  // A section "+" opens the quick-add panel, pre-scoped to that section. Top 10 opens it as a FINDER
  // (navigate mode): a rank is a swap that lives on the title's fiche, not a status you dump into —
  // so it just takes you to the title. A DIRECT add of a specific title (a recommendation) is the one
  // thing left on the modal's pre-filled form.
  const quickOpen = activeModal !== null && pendingInitialItem === null;
  const isTopTen = activeModal === "topTen";

  return (
    <WatchingContext.Provider value={{ openModal, openModalWithItem, config }}>
      <section className="p-4 sm:p-6 space-y-4">
        {children}
      </section>

      <QuickAddPanel
        open={quickOpen}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        defaultList={(quickOpen && !isTopTen ? activeModal : "wantToWatch") as ListType}
        mediaType={config.type as MediaType}
        navigate={isTopTen}
        title={isTopTen ? "Add to your Top 10" : "Add to your library"}
      />

      {/* The only thing still on the modal: a direct add of a specific title (a recommendation). */}
      <AddMediaModal
        isOpen={pendingInitialItem !== null && activeModal !== null}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        onAdded={handleAdded}
        defaultType={config.type as MediaType}
        listContext={(activeModal ?? "wantToWatch") as ListType}
        initialItem={pendingInitialItem}
      />
    </WatchingContext.Provider>
  );
}
