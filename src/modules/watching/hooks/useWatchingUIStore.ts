import { create } from "zustand";

interface PageLabel { section: string; title: string }

interface LibraryFilter { type: string; status: string; sort: string; page: number }

interface WatchingUIState {
  isDetailOpen: boolean;
  setDetailOpen: (v: boolean) => void;
  pageLabel: PageLabel | null;
  setPageLabel: (label: PageLabel | null) => void;
  // Library view filter — kept in-memory so Back from a detail page restores the
  // exact view the user left (survives the remount; resets on a full page reload).
  libraryFilter: LibraryFilter;
  setLibraryFilter: (f: LibraryFilter) => void;
  // Open list in the Lists tab — same in-memory pattern, so Back from a media
  // detail page restores the open list instead of dropping to the lists grid.
  selectedListId: string | null;
  setSelectedListId: (id: string | null) => void;
  // Stats year filter — same in-memory pattern: Back from a media detail restores
  // the year you were viewing (e.g. 2022) instead of snapping to the current year.
  // `ready` stays false until first set, so the page can default to the current
  // year without confusing it with an explicit "All time" (null) selection.
  statsYear: number | null;          // null = All time
  statsYearReady: boolean;
  setStatsYear: (y: number | null) => void;
}

export const useWatchingUIStore = create<WatchingUIState>((set) => ({
  isDetailOpen: false,
  setDetailOpen: (isDetailOpen) => set({ isDetailOpen }),
  pageLabel: null,
  setPageLabel: (pageLabel) => set({ pageLabel }),
  libraryFilter: { type: "all", status: "all", sort: "added", page: 1 },
  setLibraryFilter: (libraryFilter) => set({ libraryFilter }),
  selectedListId: null,
  setSelectedListId: (selectedListId) => set({ selectedListId }),
  statsYear: null,
  statsYearReady: false,
  setStatsYear: (statsYear) => set({ statsYear, statsYearReady: true }),
}));
