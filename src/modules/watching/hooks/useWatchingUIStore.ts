import { create } from "zustand";

interface PageLabel { section: string; title: string }

interface WatchingUIState {
  isDetailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
  pageLabel: PageLabel | null;
  setPageLabel: (label: PageLabel | null) => void;
}

export const useWatchingUIStore = create<WatchingUIState>((set) => ({
  isDetailOpen: false,
  setDetailOpen: (isDetailOpen) => set({ isDetailOpen }),
  pageLabel: null,
  setPageLabel: (pageLabel) => set({ pageLabel }),
}));
