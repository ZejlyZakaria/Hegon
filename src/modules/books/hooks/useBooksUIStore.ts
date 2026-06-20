import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BookTab } from "../types";

export type BooksView = "library" | "stats" | "quotes";

interface BooksUIState {
  // Top-level destination — Library · Stats · Quotes.
  view: BooksView;
  setView: (view: BooksView) => void;

  // Active library tab.
  activeTab: BookTab;
  setActiveTab: (tab: BookTab) => void;
}

// Persisted so a reload (and Back from a book detail) keeps the user on their tab.
// Without this, activeTab reset to "reading" on every reload → the loading skeleton
// always rendered the Reading layout (right panel) even on browse tabs. First-ever
// visit still defaults to Reading.
export const useBooksUIStore = create<BooksUIState>()(
  persist(
    (set) => ({
      view: "library",
      setView: (view) => set({ view }),
      activeTab: "reading",
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    { name: "hegon-books-ui" },
  ),
);
