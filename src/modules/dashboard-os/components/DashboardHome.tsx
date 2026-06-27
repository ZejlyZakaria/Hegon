"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Check, LayoutGrid, Image as ImageIcon } from "lucide-react";
import {
  AnimatePresence, motion, useMotionValue, useMotionTemplate, useSpring, useTransform,
  useReducedMotion, type MotionValue,
} from "framer-motion";
import { cn } from "@/shared/utils/utils";
import { Spring, type SpringConfig } from "@/shared/components/ui/motion";
import { useMounted } from "@/shared/hooks/useMounted";
import { useDashboardData } from "@/modules/dashboard/hooks/useDashboardData";
import { useHabitsToday } from "@/modules/habits/hooks/useHabitsToday";
import { useJournalToday } from "@/modules/journal/hooks/useJournalToday";
import { AppTile, type AppTileBadge } from "./AppTile";
import { OS_APPS } from "../config";
import { DEFAULT_LAYOUT, WIDGET_REGISTRY, type WidgetKey, type ItemSize, type LayoutItem } from "../layout";
import { useDashboardLayout } from "../store";
import { computeGridLayout, placedToBox, layoutHeight, type Box, type EngineItem } from "../layout-engine";
import { WallpaperPanel } from "./WallpaperPanel";

const PARIS_TZ = "Europe/Paris";
const GAP = 16;
const MAX_WIDTH = 1520;
const LIFT_THRESHOLD = 5; // px of movement before a press becomes a drag

const INSTANT: SpringConfig = { stiffness: 2200, damping: 90, mass: 0.2 };
const FOLLOW: SpringConfig = { stiffness: 1700, damping: 90, mass: 0.22 }; // ≈ 1:1 cursor

const WIDGET_LABELS: Record<WidgetKey, string> = {
  weather: "Weather", photo: "Photo", sport: "Sport", nowWatching: "Now Watching",
  today: "Today", events: "Events", habits: "Habits", books: "Books", journal: "Journal",
};

function labelFor(item: LayoutItem): string {
  return item.kind === "app" ? OS_APPS[item.ref]?.label ?? item.ref : WIDGET_LABELS[item.ref as WidgetKey] ?? item.ref;
}

// ─── grid profiles ────────────────────────────────────────────────────────────
type Profile = {
  kind: "dense" | "airy";
  cols: number;
  span: Record<ItemSize | "app", [number, number]>;
};

function profileFor(width: number): Profile {
  if (width < 600) {
    return { kind: "dense", cols: 4, span: { S: [2, 2], M: [4, 2], L: [4, 4], app: [1, 1] } };
  }
  const widgetCols = width < 1000 ? 4 : 8;
  return { kind: "airy", cols: widgetCols * 3, span: { S: [3, 1], M: [6, 1], L: [6, 2], app: [2, 1] } };
}

function spanOf(item: LayoutItem, profile: Profile): [number, number] {
  const [c, r] = item.kind === "app" ? profile.span.app : profile.span[item.size];
  return [Math.min(c, profile.cols), r];
}

// ─── grid metrics ─────────────────────────────────────────────────────────────
type Metrics = { profile: Profile; colW: number; rowUnit: number; ready: boolean };

function useGridMetrics(ref: React.RefObject<HTMLDivElement | null>): Metrics {
  const [m, setM] = useState<Metrics>(() => ({ profile: profileFor(1440), colW: 80, rowUnit: 80, ready: false }));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;
    const measure = () => {
      const width = el.clientWidth;
      // react to WIDTH only — the height is animated, and re-measuring on every
      // height frame would thrash (and could loop). Width is what drives the grid.
      if (width === lastWidth) return;
      lastWidth = width;
      const profile = profileFor(width);
      const colW = (width - GAP * (profile.cols - 1)) / profile.cols;
      const rowUnit = profile.kind === "airy" ? 3 * colW + 2 * GAP : colW;
      setM({ profile, colW, rowUnit, ready: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return m;
}

// ─── one positioned tile ──────────────────────────────────────────────────────
// Position is a pair of MotionValues (`xT`,`yT`) sprung to the visible x/y. They
// are registered up to the parent so the imperative drag loop can drive them at
// 60fps WITHOUT any React re-render. Outside a drag, the tile follows its engine
// box (resize / committed reorder).
type CellRegister = (id: string, xT: MotionValue<number> | null, yT: MotionValue<number> | null) => void;

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onRemove}
      className="absolute -left-1.5 -top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-zinc-900 shadow-lg ring-1 ring-black/25 transition-transform hover:scale-110 active:scale-95"
    >
      <Minus size={14} strokeWidth={3.5} />
    </button>
  );
}

function GridCell({
  id, box, kind, active, dragging, editing, jiggle, idx, spring, tilt, onLift, onRemove, register, children,
}: {
  id: string;
  box: Box;
  kind: "widget" | "app";
  active: boolean;
  dragging: boolean;
  editing: boolean;
  jiggle: boolean;
  idx: number;
  spring: SpringConfig;
  tilt: MotionValue<number>;
  onLift: (id: string, e: React.PointerEvent) => void;
  onRemove: () => void;
  register: CellRegister;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const config = active ? FOLLOW : reduce ? INSTANT : spring;
  const xT = useMotionValue(box.x);
  const yT = useMotionValue(box.y);
  const x = useSpring(xT, config);
  const y = useSpring(yT, config);

  // lift: 0 at rest → 1 when picked up. Under-damped so the scale OVERSHOOTS
  // slightly (a refined "pop" on pick-up) then settles — the macOS grab cue.
  const lift = useSpring(0, { stiffness: 480, damping: 26 });
  useEffect(() => { lift.set(active ? 1 : 0); }, [active, lift]);
  const liftScale = useTransform(lift, [0, 1], [1, 1.06]);
  const shadowY = useTransform(lift, [0, 1], [0, 24]);
  const shadowBlur = useTransform(lift, [0, 1], [0, 48]);
  const shadowAlpha = useTransform(lift, [0, 1], [0, 0.5]);
  const boxShadow = useMotionTemplate`0px ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`;

  useEffect(() => {
    register(id, xT, yT);
    return () => register(id, null, null);
  }, [id, xT, yT, register]);

  // outside a drag, track the engine box; during a drag the loop owns the targets
  useEffect(() => {
    if (!dragging) {
      xT.set(box.x);
      yT.set(box.y);
    }
  }, [box.x, box.y, dragging, xT, yT]);

  return (
    <motion.div
      className={cn("absolute left-0 top-0", editing && "touch-none")}
      style={{ x, y, width: box.w, height: box.h, zIndex: active ? 50 : undefined }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.78 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={editing ? (e) => onLift(id, e) : undefined}
    >
      {/* lift layer — scale + shadow + velocity tilt (active only) */}
      <motion.div
        className="h-full w-full"
        style={{ scale: liftScale, rotate: active ? tilt : 0, boxShadow, borderRadius: 22 }}
      >
        {/* jiggle layer — CSS rotate, off for the lifted tile */}
        <div
          className={cn("relative h-full w-full", jiggle && !active && "dos-jiggle")}
          style={{ animationDelay: jiggle ? `${(idx % 6) * -0.05}s` : undefined }}
        >
          {kind === "app" ? (
            // app icon is centred in a larger cell → anchor the badge to the ICON
            <div className="flex h-full w-full items-center justify-center">
              <div className="relative">
                {editing && <RemoveButton onRemove={onRemove} />}
                <div className={cn(editing && "pointer-events-none")}>{children}</div>
              </div>
            </div>
          ) : (
            // widget fills the whole cell → badge at the cell corner
            <>
              {editing && <RemoveButton onRemove={onRemove} />}
              <div className={cn("h-full w-full", editing && "pointer-events-none")}>{children}</div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DashboardHome() {
  const { data: dash } = useDashboardData();
  const { completedCount, totalCount } = useHabitsToday();
  const { data: journalEntry } = useJournalToday();

  const gridRef = useRef<HTMLDivElement>(null);
  const { profile, colW, rowUnit, ready } = useGridMetrics(gridRef);
  const metrics = { colW, rowUnit, gap: GAP };

  const mounted = useMounted();
  const bp = profile.kind; // "dense" (mobile) | "airy" (desktop/iPad) — the layout bucket
  const storedLayouts = useDashboardLayout((s) => s.layouts);
  const layout = mounted ? storedLayouts[bp] : DEFAULT_LAYOUT;
  const isEditing = useDashboardLayout((s) => s.isEditing);
  const toggleEditing = useDashboardLayout((s) => s.toggleEditing);
  const removeItem = useDashboardLayout((s) => s.removeItem);
  const setLayout = useDashboardLayout((s) => s.setLayout);
  const addItem = useDashboardLayout((s) => s.addItem);

  // catalogue (everything that CAN be on the grid) minus what's already placed
  const present = new Set(layout.map((i) => i.id));
  const available = DEFAULT_LAYOUT.filter((i) => !present.has(i.id));

  const [activeId, setActiveId] = useState<string | null>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);

  // velocity tilt of the lifted tile — springs back to flat when the cursor stops
  const tilt = useSpring(0, { stiffness: 300, damping: 26 });
  const velRef = useRef({ x: 0, y: 0 });

  // container height — sprung so the page grows/shrinks smoothly on reflow
  const heightMV = useSpring(0, { stiffness: 320, damping: 36 });
  const heightInit = useRef(false);

  // ── imperative drag plumbing (no React state in the per-frame loop) ──
  const registry = useRef(new Map<string, { xT: MotionValue<number>; yT: MotionValue<number> }>());
  const register = useCallback<CellRegister>((id, xT, yT) => {
    if (xT && yT) registry.current.set(id, { xT, yT });
    else registry.current.delete(id);
  }, []);

  const pointer = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const staggerTimers = useRef<number[]>([]); // pending make-room ripple timers
  const dragRef = useRef<null | {
    id: string; grabDX: number; grabDY: number; w: number; h: number;
    order: LayoutItem[]; cols: number; started: boolean; startX: number; startY: number;
    lastCx: number; lastCy: number;
  }>(null);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: PARIS_TZ });
  const habitsRemaining = Math.max(0, totalCount - completedCount);
  const tasksDue = (dash?.tasks ?? []).filter((t) => t.due_date && t.due_date.slice(0, 10) <= today).length;
  const badges: Record<string, AppTileBadge | undefined> = {
    habits: habitsRemaining > 0 ? { value: habitsRemaining } : undefined,
    tasks: tasksDue > 0 ? { value: tasksDue } : undefined,
    journal: journalEntry ? undefined : { dot: true },
  };

  const renderContent = (item: LayoutItem): React.ReactNode => {
    if (item.kind === "app") {
      const app = OS_APPS[item.ref];
      if (!app) return null;
      return <AppTile app={app} badge={badges[app.key]} />;
    }
    const Widget = WIDGET_REGISTRY[item.ref as WidgetKey];
    return Widget ? <Widget /> : null;
  };

  const toEngineItems = (items: LayoutItem[]): EngineItem[] =>
    items.map((item) => {
      const [colSpan, rowSpan] = spanOf(item, profile);
      return { id: item.id, colSpan, rowSpan };
    });

  // static layout (the rendered, store-order positions when not dragging)
  const result = computeGridLayout(toEngineItems(layout), profile.cols);
  const height = ready ? layoutHeight(result, metrics) : 0;

  // drive the container-height spring (jump before first paint → no settle on load)
  useLayoutEffect(() => {
    if (!ready) return;
    if (!heightInit.current) { heightMV.jump(height); heightInit.current = true; }
    else heightMV.set(height);
  }, [ready, height, heightMV]);

  const sameOrder = (a: LayoutItem[], b: LayoutItem[]) =>
    a.length === b.length && a.every((it, i) => it.id === b[i].id);

  // Best arrangement: try inserting the dragged tile at EVERY position, lay each
  // out with the pure engine, and keep the one whose resulting slot for the tile
  // sits closest to where the tile physically is (its box centre). Continuous and
  // overlap-free by construction — handles every size combination, no dead zones.
  const bestOrder = (activeId: string, order: LayoutItem[], cols: number, cx: number, cy: number): LayoutItem[] => {
    const without = order.filter((i) => i.id !== activeId);
    const activeItem = order.find((i) => i.id === activeId);
    if (!activeItem) return order;
    let best = order;
    let bestDist = Infinity;
    for (let k = 0; k <= without.length; k++) {
      const trial = without.slice();
      trial.splice(k, 0, activeItem);
      const res = computeGridLayout(toEngineItems(trial), cols);
      const p = res.byId[activeId];
      if (!p) continue;
      const b = placedToBox(p, metrics);
      const dx = b.x + b.w / 2 - cx;
      const dy = b.y + b.h / 2 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) { bestDist = d2; best = trial; }
    }
    return best;
  };

  const loop = () => {
    const d = dragRef.current;
    const el = gridRef.current;
    if (!d || !el) return;

    const ax = pointer.current.x - d.grabDX;
    const ay = pointer.current.y - d.grabDY;
    const mvA = registry.current.get(d.id);
    mvA?.xT.set(ax);
    mvA?.yT.set(ay);

    // horizontal velocity → a tiny tilt (clamped), springs back to 0 when still
    const vx = pointer.current.x - velRef.current.x;
    velRef.current = { x: pointer.current.x, y: pointer.current.y };
    tilt.set(Math.max(-6, Math.min(6, vx * 0.4)));

    // Re-pack only when the tile's centre has actually moved (skip redundant work
    // when the cursor is still). The dragged tile's box CENTRE drives insertion.
    const cx = ax + d.w / 2;
    const cy = ay + d.h / 2;
    if (Math.hypot(cx - d.lastCx, cy - d.lastCy) > 2) {
      d.lastCx = cx;
      d.lastCy = cy;
      const next = bestOrder(d.id, d.order, d.cols, cx, cy);
      if (!sameOrder(next, d.order)) {
        d.order = next;
        const res = computeGridLayout(toEngineItems(next), d.cols);

        // RIPPLE: only the tiles that actually move, released in a wave from the
        // dragged tile outward (closest first). A reorder mid-wave clears pending
        // timers and re-schedules from the latest order.
        for (const t of staggerTimers.current) clearTimeout(t);
        staggerTimers.current = [];

        const movers: { mv: { xT: MotionValue<number>; yT: MotionValue<number> }; bx: number; by: number; dist: number }[] = [];
        for (const item of next) {
          if (item.id === d.id) continue;
          const p = res.byId[item.id];
          if (!p) continue;
          const mv = registry.current.get(item.id);
          if (!mv) continue;
          const b = placedToBox(p, metrics);
          // skip tiles already at their target (most tiles don't move on a reorder)
          if (Math.abs(mv.xT.get() - b.x) + Math.abs(mv.yT.get() - b.y) < 1) continue;
          const dist = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
          movers.push({ mv, bx: b.x, by: b.y, dist });
        }
        movers.sort((a, b) => a.dist - b.dist);

        const STEP = 12; // ms between successive tiles in the wave
        const MAX_DELAY = 120;
        movers.forEach((m, i) => {
          const delay = Math.min(MAX_DELAY, i * STEP);
          if (delay === 0) {
            m.mv.xT.set(m.bx);
            m.mv.yT.set(m.by);
          } else {
            const t = window.setTimeout(() => { m.mv.xT.set(m.bx); m.mv.yT.set(m.by); }, delay);
            staggerTimers.current.push(t);
          }
        });
        heightMV.set(layoutHeight(res, metrics));
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  const onPointerMove = (e: PointerEvent) => {
    const el = gridRef.current;
    const d = dragRef.current;
    if (!el || !d) return;
    const rect = el.getBoundingClientRect();
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // promote a press to a drag only after a small movement
    if (!d.started) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < LIFT_THRESHOLD) return;
      d.started = true;
      setActiveId(d.id);
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    cancelAnimationFrame(rafRef.current);
    for (const t of staggerTimers.current) clearTimeout(t);
    staggerTimers.current = [];
    const d = dragRef.current;
    if (d?.started) setLayout(bp, d.order);
    dragRef.current = null;
    tilt.set(0);
    setActiveId(null);
  };

  const onLift = (id: string, e: React.PointerEvent) => {
    if (!isEditing) return;
    const el = gridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const placed = result.byId[id];
    if (!placed) return;
    const b = placedToBox(placed, metrics);
    pointer.current = { x: px, y: py };
    velRef.current = { x: px, y: py };
    dragRef.current = {
      id, grabDX: px - b.x, grabDY: py - b.y, w: b.w, h: b.h,
      order: layout.slice(),
      cols: profile.cols, started: false, startX: e.clientX, startY: e.clientY,
      lastCx: px - b.x + b.w / 2, lastCy: py - b.y + b.h / 2,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    for (const t of staggerTimers.current) clearTimeout(t);
  }, []);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <motion.div ref={gridRef} className="relative mx-auto" style={{ height: ready ? heightMV : 0, maxWidth: MAX_WIDTH }}>
        <AnimatePresence initial={false}>
          {ready && layout.map((item, idx) => {
            const placed = result.byId[item.id];
            if (!placed) return null;
            return (
              <GridCell
                key={item.id}
                id={item.id}
                box={placedToBox(placed, metrics)}
                kind={item.kind}
                active={item.id === activeId}
                dragging={activeId !== null}
                editing={isEditing}
                jiggle={isEditing && !wallpaperOpen}
                idx={idx}
                spring={item.kind === "app" ? Spring.Launchpad : Spring.Widget}
                tilt={tilt}
                onLift={onLift}
                onRemove={() => removeItem(bp, item.id)}
                register={register}
              >
                {renderContent(item)}
              </GridCell>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Add-widget tray — only in edit mode, shows what can be (re)added */}
      <AnimatePresence>
        {isEditing && available.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4"
          >
            <div className="flex max-w-[calc(100vw-2rem)] gap-2 overflow-x-auto rounded-2xl border border-white/15 bg-white/10 p-2 shadow-xl backdrop-blur-2xl">
              {available.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(bp, item)}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-white/10 py-2 pl-3 pr-2.5 text-[12px] font-medium text-white/90 ring-1 ring-white/10 transition-colors hover:bg-white/20"
                >
                  <span className="whitespace-nowrap">{labelFor(item)}</span>
                  <span className="rounded-md bg-white/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/55">
                    {item.kind === "app" ? "App" : item.size}
                  </span>
                  <Plus size={14} className="text-white/80" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customize controls — floating pills (Wallpaper appears in edit mode) */}
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2">
        {isEditing && (
          <button
            type="button"
            onClick={() => setWallpaperOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white shadow-xl ring-1 ring-white/20 backdrop-blur-xl transition-colors hover:bg-white/15"
          >
            <ImageIcon size={15} /> Wallpaper
          </button>
        )}
        <button
          type="button"
          onClick={toggleEditing}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-xl backdrop-blur-xl transition-colors",
            isEditing
              ? "bg-white text-zinc-900 ring-1 ring-black/10"
              : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15",
          )}
        >
          {isEditing ? <Check size={15} strokeWidth={3} /> : <LayoutGrid size={15} />}
          {isEditing ? "Done" : "Customize"}
        </button>
      </div>

      <WallpaperPanel open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} />
    </div>
  );
}
