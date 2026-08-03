import { create } from "zustand";

// UI state only: which match's panel is open. A store (not prop-drilling) because the trigger is a
// deeply-nested card and the panel is rendered once at the page root.
interface MatchPanelState {
  openId: number | null;
  open: (externalMatchId: number) => void;
  close: () => void;
}

export const useMatchPanel = create<MatchPanelState>((set) => ({
  openId: null,
  open: (externalMatchId) => set({ openId: externalMatchId }),
  close: () => set({ openId: null }),
}));
