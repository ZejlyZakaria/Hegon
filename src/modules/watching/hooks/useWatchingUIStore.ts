import { create } from "zustand";

interface PageLabel { section: string; title: string }

interface LibraryFilter { type: string; sort: string; page: number }

interface WatchingUIState {
  isDetailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
  pageLabel: PageLabel | null;
  setPageLabel: (label: PageLabel | null) => void;
  // Library view filter — kept in-memory so Back from a detail page restores the
  // exact view the user left (survives the remount; resets on a full page reload).
  libraryFilter: LibraryFilter;
  setLibraryFilter: (f: LibraryFilter) => void;
}

export const useWatchingUIStore = create<WatchingUIState>((set) => ({
  isDetailOpen: false,
  setDetailOpen: (isDetailOpen) => set({ isDetailOpen }),
  pageLabel: null,
  setPageLabel: (pageLabel) => set({ pageLabel }),
  libraryFilter: { type: "all", sort: "added", page: 1 },
  setLibraryFilter: (libraryFilter) => set({ libraryFilter }),
}));
