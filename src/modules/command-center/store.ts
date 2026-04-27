import { create } from 'zustand';

export type PendingAction = 'new-goal' | 'new-habit' | 'new-book' | null;

interface CommandCenterState {
  isOpen:             boolean;
  pendingAction:      PendingAction;
  open:               () => void;
  close:              () => void;
  toggle:             () => void;
  setPendingAction:   (action: PendingAction) => void;
  clearPendingAction: () => void;
}

export const useCommandCenter = create<CommandCenterState>((set) => ({
  isOpen:             false,
  pendingAction:      null,
  open:               () => set({ isOpen: true }),
  close:              () => set({ isOpen: false }),
  toggle:             () => set((s) => ({ isOpen: !s.isOpen })),
  setPendingAction:   (action) => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),
}));
