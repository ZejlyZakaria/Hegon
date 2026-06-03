"use client";

import { useState, createContext, useContext, useCallback } from "react";

import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { WatchingConfig, MediaType } from "@/modules/watching/types";

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

  return (
    <WatchingContext.Provider value={{ openModal, openModalWithItem, config }}>
      <section className="p-6 space-y-6">
        {children}
      </section>

      <AddMediaModal
        isOpen={activeModal === "topTen"}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        onAdded={handleAdded}
        defaultType={config.type as MediaType}
        listContext="topTen"
        initialItem={activeModal === "topTen" ? pendingInitialItem : null}
      />
      <AddMediaModal
        isOpen={activeModal === "inProgress"}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        onAdded={handleAdded}
        defaultType={config.type as MediaType}
        listContext="inProgress"
        initialItem={activeModal === "inProgress" ? pendingInitialItem : null}
      />
      <AddMediaModal
        isOpen={activeModal === "recentlyWatched"}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        onAdded={handleAdded}
        defaultType={config.type as MediaType}
        listContext="recentlyWatched"
        initialItem={activeModal === "recentlyWatched" ? pendingInitialItem : null}
      />
      <AddMediaModal
        isOpen={activeModal === "wantToWatch"}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        onAdded={handleAdded}
        defaultType={config.type as MediaType}
        listContext="wantToWatch"
        initialItem={activeModal === "wantToWatch" ? pendingInitialItem : null}
      />
    </WatchingContext.Provider>
  );
}
