/* eslint-disable react-hooks/refs */
// components/watching/WatchingClient.tsx
"use client";

import { useState, createContext, useContext, useCallback, useRef } from "react";

import AddMediaModal from "@/modules/watching/components/modals/AddMediaModal";
import type { WatchingConfig, MediaType, WatchingMedia } from "@/modules/watching/types";

// ─── types ────────────────────────────────────────────────────────────────────

type ListContext = "topTen" | "inProgress" | "recentlyWatched" | "wantToWatch";

interface WatchingContextValue {
  openModal: (ctx: ListContext) => void;
  openModalWithItem: (ctx: ListContext, item: unknown) => void;
  config: WatchingConfig;
  // item ajouté → notifier la bonne section
  registerOnAdded: (ctx: ListContext, fn: (item: WatchingMedia) => void) => void;
  unregisterOnAdded: (ctx: ListContext) => void;
  // item mis à jour (favori, notes...) → notifier toutes les sections
  registerOnUpdated: (key: string, fn: (item: WatchingMedia) => void) => void;
  unregisterOnUpdated: (key: string) => void;
  notifyUpdated: (item: WatchingMedia) => void;
  // item déplacé (ex: wantToWatch → recentlyWatched)
  registerOnMoved: (ctx: ListContext, fn: (item: WatchingMedia) => void) => void;
  unregisterOnMoved: (ctx: ListContext) => void;
  notifyMoved: (from: ListContext, item: WatchingMedia) => void;
  // ✅ item supprimé → notifier toutes les sections
  registerOnDeleted: (key: string, fn: (itemId: string) => void) => void;
  unregisterOnDeleted: (key: string) => void;
  notifyDeleted: (itemId: string) => void;
}

export const WatchingContext = createContext<WatchingContextValue>({
  openModal: () => {},
  openModalWithItem: () => {},
  config: {} as WatchingConfig,
  registerOnAdded: () => {},
  unregisterOnAdded: () => {},
  registerOnUpdated: () => {},
  unregisterOnUpdated: () => {},
  notifyUpdated: () => {},
  registerOnMoved: () => {},
  unregisterOnMoved: () => {},
  notifyMoved: () => {},
  registerOnDeleted: () => {},
  unregisterOnDeleted: () => {},
  notifyDeleted: () => {},
});

export const useWatching = () => useContext(WatchingContext);

// ─── main ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  config: WatchingConfig;
  children: React.ReactNode;
}

export default function WatchingClient({ config, children }: Props) {
  const [activeModal, setActiveModal] = useState<ListContext | null>(null);
  const [pendingInitialItem, setPendingInitialItem] = useState<unknown>(null);

  // refs pour les callbacks — pas de re-render quand on register/unregister
  const addedCbs  = useRef<Partial<Record<ListContext, (item: WatchingMedia) => void>>>({});
  const updatedCbs = useRef<Record<string, (item: WatchingMedia) => void>>({});
  const movedCbs  = useRef<Partial<Record<ListContext, (item: WatchingMedia) => void>>>({});
  const deletedCbs = useRef<Record<string, (itemId: string) => void>>({});  // ✅ AJOUTÉ

  const activeModalRef = useRef<ListContext | null>(null);
  activeModalRef.current = activeModal;

  const openModal = useCallback((ctx: ListContext) => {
    setPendingInitialItem(null);
    setActiveModal(ctx);
  }, []);

  const openModalWithItem = useCallback((ctx: ListContext, item: unknown) => {
    setPendingInitialItem(item);
    setActiveModal(ctx);
  }, []);

  // ── added callbacks ──
  const registerOnAdded = useCallback((ctx: ListContext, fn: (item: WatchingMedia) => void) => {
    addedCbs.current[ctx] = fn;
  }, []);
  const unregisterOnAdded = useCallback((ctx: ListContext) => {
    delete addedCbs.current[ctx];
  }, []);

  // ── updated callbacks ──
  const registerOnUpdated = useCallback((key: string, fn: (item: WatchingMedia) => void) => {
    updatedCbs.current[key] = fn;
  }, []);
  const unregisterOnUpdated = useCallback((key: string) => {
    delete updatedCbs.current[key];
  }, []);
  const notifyUpdated = useCallback((item: WatchingMedia) => {
    Object.values(updatedCbs.current).forEach(fn => fn(item));
  }, []);

  // ── moved callbacks ──
  const registerOnMoved = useCallback((ctx: ListContext, fn: (item: WatchingMedia) => void) => {
    movedCbs.current[ctx] = fn;
  }, []);
  const unregisterOnMoved = useCallback((ctx: ListContext) => {
    delete movedCbs.current[ctx];
  }, []);
  const notifyMoved = useCallback((from: ListContext, item: WatchingMedia) => {
    // notify destination — wantToWatch → recentlyWatched
    const destinations: Partial<Record<ListContext, ListContext>> = {
      wantToWatch: "recentlyWatched",
      inProgress:  "recentlyWatched",
    };
    const dest = destinations[from];
    if (dest && movedCbs.current[dest]) {
      movedCbs.current[dest]!(item);
    }
  }, []);

  // ✅ ── deleted callbacks ──
  const registerOnDeleted = useCallback((key: string, fn: (itemId: string) => void) => {
    deletedCbs.current[key] = fn;
  }, []);
  const unregisterOnDeleted = useCallback((key: string) => {
    delete deletedCbs.current[key];
  }, []);
  const notifyDeleted = useCallback((itemId: string) => {
    // Notifier TOUTES les sections pour suppression immédiate cross-section
    Object.values(deletedCbs.current).forEach(fn => fn(itemId));
  }, []);

  // called when AddMediaModal succeeds
  const handleAdded = useCallback((item?: WatchingMedia) => {
    setActiveModal(null);
    setPendingInitialItem(null);
    if (!item) return;
    const ctx = activeModalRef.current;
    if (ctx && addedCbs.current[ctx]) {
      addedCbs.current[ctx]!(item);
    }
  }, []);

  const contextValue: WatchingContextValue = {
    openModal, openModalWithItem, config,
    registerOnAdded, unregisterOnAdded,
    registerOnUpdated, unregisterOnUpdated, notifyUpdated,
    registerOnMoved, unregisterOnMoved, notifyMoved,
    registerOnDeleted, unregisterOnDeleted, notifyDeleted,  // ✅ AJOUTÉ
  };

  return (
    <WatchingContext.Provider value={contextValue}>
      <section className="p-6 space-y-2">
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