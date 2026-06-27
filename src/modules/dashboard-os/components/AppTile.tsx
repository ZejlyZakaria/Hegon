import Link from "next/link";
import { cn } from "@/shared/utils/utils";
import type { OsApp } from "../config";

// A home-screen app tile — glyph on an accent gradient, iOS superellipse corner.
// `TileFace` is the pure visual (no link/label) so the dock can wrap it in its
// own tooltip/link; `AppTile` adds the label + Link for the grid.

export interface AppTileBadge {
  // Short text badge ("3", "12") or a bare dot (no value) for "needs attention".
  value?: string | number;
  dot?: boolean;
}

const SIZES = {
  dock: { tile: 42, radius: 12, icon: 20 },
  grid: { tile: 60, radius: 16, icon: 28 },
} as const;

export type TileSize = keyof typeof SIZES;

export function TileFace({
  app,
  size = "grid",
  badge,
  active = false,
}: {
  app: OsApp;
  size?: TileSize;
  badge?: AppTileBadge;
  active?: boolean;
}) {
  const s = SIZES[size];
  const Glyph = app.icon;

  return (
    <div
      className={cn(
        "relative grid place-items-center text-white transition-transform duration-150",
        "group-hover:scale-[1.07] group-active:scale-95",
        app.comingSoon && "opacity-40 saturate-50",
      )}
      style={{
        width: s.tile,
        height: s.tile,
        borderRadius: s.radius,
        background: `linear-gradient(155deg, ${app.from}, ${app.to})`,
        boxShadow: active
          ? `inset 0 1px 0 0 rgba(255,255,255,0.35), 0 0 0 2px rgba(255,255,255,0.7), 0 6px 16px -6px rgba(0,0,0,0.7)`
          : "inset 0 1px 0 0 rgba(255,255,255,0.35), inset 0 0 0 0.5px rgba(255,255,255,0.12), 0 6px 16px -6px rgba(0,0,0,0.7)",
      }}
    >
      {/* iOS gloss — light catches the top half */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: s.radius,
          background: "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 52%)",
        }}
      />
      <Glyph size={s.icon} strokeWidth={2} className="relative drop-shadow-sm" />

      {badge && !app.comingSoon && (
        <span
          className={cn(
            "absolute flex items-center justify-center font-bold text-white tabular-nums ring-2 ring-black/30",
            badge.dot ? "h-2.5 w-2.5 rounded-full" : "min-w-4.5 h-4.5 px-1 rounded-full text-[10px]",
          )}
          style={{ top: -4, right: -4, background: badge.dot ? app.from : "#ef4444" }}
        >
          {!badge.dot && badge.value}
        </span>
      )}
    </div>
  );
}

export function AppTile({
  app,
  size = "grid",
  badge,
  showLabel = size === "grid",
}: {
  app: OsApp;
  size?: TileSize;
  badge?: AppTileBadge;
  showLabel?: boolean;
}) {
  const labelled = (
    <div className="group flex flex-col items-center gap-1.5">
      <TileFace app={app} size={size} badge={badge} />
      {showLabel && (
        <span className="max-w-16 truncate text-[11px] font-medium text-white/85 drop-shadow-sm">
          {app.label}
        </span>
      )}
    </div>
  );

  if (app.comingSoon) {
    return <div className="cursor-default">{labelled}</div>;
  }

  return (
    <Link href={app.href} className="block focus:outline-none">
      {labelled}
    </Link>
  );
}
