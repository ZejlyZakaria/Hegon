import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WatchFace } from "./components/HabitWatch";
import type { HabitTab } from "./types";

// UI-only state for the Habits module. The selected watch face is a personal
// preference, persisted locally (unlock eligibility is derived from streaks,
// so nothing here needs the database). The detail panel target + active tab
// are transient (so cross-component navigation, e.g. Stats → All, can drive them).
interface HabitsUIState {
  watchFace: WatchFace;
  setWatchFace: (face: WatchFace) => void;
  activeTab: HabitTab;
  setActiveTab: (tab: HabitTab) => void;
  openHabitId: string | null;
  openPanel: (habitId: string) => void;
  closePanel: () => void;
  // achievement keys already celebrated (so we don't re-toast every visit)
  seenAchievements: string[];
  markAchievementsSeen: (keys: string[]) => void;
}

export const useHabitsUIStore = create<HabitsUIState>()(
  persist(
    (set) => ({
      watchFace: "onyx",
      setWatchFace: (watchFace) => set({ watchFace }),
      activeTab: "today",
      setActiveTab: (activeTab) => set({ activeTab }),
      openHabitId: null,
      openPanel: (openHabitId) => set({ openHabitId }),
      closePanel: () => set({ openHabitId: null }),
      seenAchievements: [],
      markAchievementsSeen: (seenAchievements) => set({ seenAchievements }),
    }),
    {
      name: "hegon_habits_ui",
      partialize: (s) => ({
        watchFace: s.watchFace,
        seenAchievements: s.seenAchievements,
      }),
    },
  ),
);
