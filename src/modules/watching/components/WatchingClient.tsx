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

  // A section "+" opens the quick-add panel, pre-scoped to that section (search, nothing pre-picked).
  // Top 10 is excluded — adding with a rank needs the modal's picker — and a DIRECT add of a specific
  // title (a recommendation) keeps the modal's direct mode. Everything else is a quick pass.
  const quickOpen = activeModal !== null && activeModal !== "topTen" && pendingInitialItem === null;

  return (
    <WatchingContext.Provider value={{ openModal, openModalWithItem, config }}>
      <section className="p-4 sm:p-6 space-y-4">
        {children}
      </section>

      <QuickAddPanel
        open={quickOpen}
        onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
        defaultList={(quickOpen ? activeModal : "wantToWatch") as ListType}
        mediaType={config.type as MediaType}
      />

      {/* Top 10 (needs the rank picker) + any direct add of a specific title still use the modal. */}
      {(["topTen", "inProgress", "recentlyWatched", "wantToWatch"] as const).map((ctx) => (
        <AddMediaModal
          key={ctx}
          isOpen={activeModal === ctx && (ctx === "topTen" || pendingInitialItem !== null)}
          onClose={() => { setActiveModal(null); setPendingInitialItem(null); }}
          onAdded={handleAdded}
          defaultType={config.type as MediaType}
          listContext={ctx}
          initialItem={activeModal === ctx ? pendingInitialItem : null}
        />
      ))}
    </WatchingContext.Provider>
  );
}
