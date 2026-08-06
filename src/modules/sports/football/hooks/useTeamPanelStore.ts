import { create } from "zustand";
import type { FootballTeam } from "../types";

// The team whose panel is open. Carries the whole team (+ isMain) so the panel has crest/name/ids
// without a round-trip. UI state only — a store, not prop-drilling, because the trigger is a card in
// the Following strip and the panel is rendered once at the page root.
export interface TeamPanelTeam extends FootballTeam {
  isMain: boolean;
}

interface TeamPanelState {
  team: TeamPanelTeam | null;
  open: (team: TeamPanelTeam) => void;
  close: () => void;
}

export const useTeamPanel = create<TeamPanelState>((set) => ({
  team: null,
  open: (team) => set({ team }),
  close: () => set({ team: null }),
}));
