import { create } from "zustand";
import type { BookTab } from "../types";

export type BooksView = "library" | "stats" | "quotes";

interface BooksUIState {
  // Top-level destination — Library · Stats · Quotes (in-memory so Back from a
  // book detail restores the view; resets on a full page reload).
  view: BooksView;
  setView: (view: BooksView) => void;

  // Active library tab — kept in-memory so Back from a book detail page restores
  // the tab the user was on (survives the remount; resets on a full page reload).
  activeTab: BookTab;
  setActiveTab: (tab: BookTab) => void;
}

export const useBooksUIStore = create<BooksUIState>((set) => ({
  view: "library",
  setView: (view) => set({ view }),
  activeTab: "reading",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
