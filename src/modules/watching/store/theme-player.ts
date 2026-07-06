import { create } from "zustand";

export interface PlayerTrack {
  id: string;             // unique per track (anime + label)
  label: string;          // "OP1"
  title: string;          // song title
  artist: string;
  audioUrl: string | null;
  videoUrl: string | null;
  animeName: string;
  cover: string | null;        // display artwork (iTunes single art in the detail panel)
  animePoster: string | null;  // the anime's own poster (used by "My Themes")
}

interface ThemePlayerState {
  queue: PlayerTrack[];
  index: number;
  isPlaying: boolean;
  showVideo: boolean;
  play: (queue: PlayerTrack[], startIndex: number) => void;
  toggle: () => void;
  setPlaying: (v: boolean) => void;
  next: () => void;
  prev: () => void;
  openVideo: () => void;
  closeVideo: () => void;
  close: () => void;
}

// Global, persistent-in-memory player for anime OP/ED. Lives above the Watching
// layout so playback continues while you browse (Watching-only in v1).
export const useThemePlayer = create<ThemePlayerState>((set) => ({
  queue: [],
  index: 0,
  isPlaying: false,
  showVideo: false,
  play: (queue, startIndex) => set({ queue, index: startIndex, isPlaying: true, showVideo: false }),
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (v) => set({ isPlaying: v }),
  next: () =>
    set((s) => (s.index < s.queue.length - 1 ? { index: s.index + 1, isPlaying: true } : { isPlaying: false })),
  prev: () => set((s) => ({ index: Math.max(0, s.index - 1), isPlaying: true })),
  openVideo: () => set({ showVideo: true }),
  closeVideo: () => set({ showVideo: false }),
  close: () => set({ queue: [], index: 0, isPlaying: false, showVideo: false }),
}));
