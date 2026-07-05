import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlayerTrack } from "./theme-player";

interface ThemeFavoritesState {
  // id → track, so we can render a "My Themes" playlist later.
  favorites: Record<string, PlayerTrack>;
  toggle: (track: PlayerTrack) => void;
  has: (id: string) => boolean;
}

// Favorited OP/ED — persisted locally (v1). The 3rd surface ("My Themes" playlist)
// will read from here.
export const useThemeFavorites = create<ThemeFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},
      toggle: (track) =>
        set((s) => {
          const next = { ...s.favorites };
          if (next[track.id]) delete next[track.id];
          else next[track.id] = track;
          return { favorites: next };
        }),
      has: (id) => !!get().favorites[id],
    }),
    { name: "hegon-theme-favorites" },
  ),
);
