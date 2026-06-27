import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LAYOUT, type LayoutItem } from "./layout";

// ─── Dashboard layout store ───────────────────────────────────────────────────
// Source of truth for what's on the home grid and in what order. A phone (2-col)
// and a desktop (8-col) can't hold the same arrangement, so the layout is kept
// PER BREAKPOINT bucket: "dense" (mobile) and "airy" (iPad/desktop). The grid
// renders the bucket for the current breakpoint; Customize mutates that bucket.
// Persisted so a user's arrangement survives reloads (later: synced to Supabase).

export type Breakpoint = "dense" | "airy";

interface DashboardLayoutState {
  layouts: Record<Breakpoint, LayoutItem[]>;
  isEditing: boolean;

  setEditing: (v: boolean) => void;
  toggleEditing: () => void;

  // All mutations target one breakpoint bucket explicitly (the caller knows it).
  setLayout: (bp: Breakpoint, layout: LayoutItem[]) => void;
  removeItem: (bp: Breakpoint, id: string) => void;
  addItem: (bp: Breakpoint, item: LayoutItem, index?: number) => void;
  resetLayout: (bp: Breakpoint) => void;
}

function setBucket(
  s: DashboardLayoutState,
  bp: Breakpoint,
  next: LayoutItem[],
): Partial<DashboardLayoutState> {
  return { layouts: { ...s.layouts, [bp]: next } };
}

export const useDashboardLayout = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      layouts: { dense: DEFAULT_LAYOUT, airy: DEFAULT_LAYOUT },
      isEditing: false,

      setEditing: (isEditing) => set({ isEditing }),
      toggleEditing: () => set((s) => ({ isEditing: !s.isEditing })),

      setLayout: (bp, layout) => set((s) => setBucket(s, bp, layout)),

      removeItem: (bp, id) =>
        set((s) => setBucket(s, bp, s.layouts[bp].filter((i) => i.id !== id))),

      addItem: (bp, item, index) =>
        set((s) => {
          const bucket = s.layouts[bp];
          if (bucket.some((i) => i.id === item.id)) return s;
          const next = bucket.slice();
          next.splice(index ?? next.length, 0, item);
          return setBucket(s, bp, next);
        }),

      resetLayout: (bp) => set((s) => setBucket(s, bp, DEFAULT_LAYOUT)),
    }),
    {
      name: "hegon-dashboard-layout",
      version: 2,
      // only the arrangements are persisted; isEditing is always a fresh session
      partialize: (s) => ({ layouts: s.layouts }),
      // v1 stored a single `layout` → seed both buckets from it.
      migrate: (persisted, version): { layouts: Record<Breakpoint, LayoutItem[]> } => {
        if (version < 2 && persisted && typeof persisted === "object" && "layout" in persisted) {
          const single = (persisted as { layout?: LayoutItem[] }).layout ?? DEFAULT_LAYOUT;
          return { layouts: { dense: single, airy: single } };
        }
        const p = persisted as { layouts?: Record<Breakpoint, LayoutItem[]> };
        return { layouts: p?.layouts ?? { dense: DEFAULT_LAYOUT, airy: DEFAULT_LAYOUT } };
      },
    },
  ),
);
