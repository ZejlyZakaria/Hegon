import { create } from "zustand";
import type { BookTab } from "../types";

interface BooksUIState {
  // Active library tab — kept in-memory so Back from a book detail page restores
  // the tab the user was on (survives the remount; resets on a full page reload).
  activeTab: BookTab;
  setActiveTab: (tab: BookTab) => void;
}

export const useBooksUIStore = create<BooksUIState>((set) => ({
  activeTab: "reading",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
