import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TodayUpNextCard from "./TodayUpNextCard";
import TodayWeatherCard from "./TodayWeatherCard";
import FootballCrestCard from "./FootballCrestCard";
import TennisNarrowCard from "./TennisNarrowCard";
import type { DashboardSportEvent } from "../../types";

// ─── Overflow indicator ───────────────────────────────────────────────────────

function OverflowLink({ count, href }: { count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-0.5 py-0.5"
    >
      <ArrowRight size={9} />
      <span>+{count} more</span>
    </Link>
  );
}

// ─── Single-sport stacked column ──────────────────────────────────────────────

function FootballStack({ events }: { events: DashboardSportEvent[] }) {
  const shown = events.slice(0, 2);
  const overflow = events.length - 2;
  return (
    <div className="flex flex-col gap-2 h-full">
      {shown.map((e, i) => (
        <FootballCrestCard key={i} event={e} className="flex-1" />
      ))}
      {overflow > 0 && (
        <OverflowLink count={overflow} href="/perso/sports/football" />
      )}
    </div>
  );
}

function TennisStack({ events }: { events: DashboardSportEvent[] }) {
  const shown = events.slice(0, 2);
  const overflow = events.length - 2;
  return (
    <div className="flex flex-col gap-2 h-full">
      {shown.map((e, i) => (
        <TennisNarrowCard key={i} event={e} className="flex-1" />
      ))}
      {overflow > 0 && (
        <OverflowLink count={overflow} href="/perso/sports/tennis" />
      )}
    </div>
  );
}

// ─── Mixed sports: 2-column, 1 card max per sport ────────────────────────────
// Height stays consistent with the priority card — never stacks vertically.

function MixedSportsSlot({
  football,
  tennis,
}: {
  football: DashboardSportEvent[];
  tennis: DashboardSportEvent[];
}) {
  // Football: main team match is already first (sorted in service)
  const footballEvent = football[0];
  const footballOverflow = football.length - 1;

  // Tennis: first scheduled match
  const tennisEvent = tennis[0];
  const tennisOverflow = tennis.length - 1;

  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      {/* Football column */}
      {footballEvent && (
        <div className="flex flex-col gap-1.5 h-full">
          <FootballCrestCard event={footballEvent} className="flex-1" />
          {footballOverflow > 0 && (
            <OverflowLink count={footballOverflow} href="/perso/sports/football" />
          )}
        </div>
      )}

      {/* Tennis column */}
      {tennisEvent && (
        <div className="flex flex-col gap-1.5 h-full">
          <TennisNarrowCard event={tennisEvent} className="flex-1" />
          {tennisOverflow > 0 && (
            <OverflowLink count={tennisOverflow} href="/perso/sports/tennis" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  football: DashboardSportEvent[];
  tennis: DashboardSportEvent[];
  f1: DashboardSportEvent | null; // null when F1 is shown in middle column
}

export default function TodayRightSlot({ football, tennis, f1 }: Props) {
  const hasFootball = football.length > 0;
  const hasTennis = tennis.length > 0;
  const hasF1 = f1 !== null;
  const sportTypeCount =
    (hasFootball ? 1 : 0) + (hasTennis ? 1 : 0) + (hasF1 ? 1 : 0);

  // ── No events ──
  if (sportTypeCount === 0) return <TodayWeatherCard variant="mid" />;

  // ── F1 only (no football/tennis) ──
  if (hasF1 && !hasFootball && !hasTennis) {
    return <TodayUpNextCard event={f1} />;
  }

  // ── Football only ──
  if (hasFootball && !hasTennis && !hasF1) {
    if (football.length === 1) return <TodayUpNextCard event={football[0]} />;
    // 2+ football: side by side (grid-cols-2), overflow below
    return (
      <div className="flex flex-col gap-2 h-full">
        <div className="grid grid-cols-2 gap-2 flex-1">
          {football.slice(0, 2).map((e, i) => (
            <FootballCrestCard key={i} event={e} className="h-full" />
          ))}
        </div>
        {football.length > 2 && (
          <OverflowLink count={football.length - 2} href="/perso/sports/football" />
        )}
      </div>
    );
  }

  // ── Tennis only ──
  if (hasTennis && !hasFootball && !hasF1) {
    if (tennis.length === 1) return <TodayUpNextCard event={tennis[0]} />;
    // 2+ tennis: side by side (grid-cols-2), overflow below
    return (
      <div className="flex flex-col gap-2 h-full">
        <div className="grid grid-cols-2 gap-2 flex-1">
          {tennis.slice(0, 2).map((e, i) => (
            <TennisNarrowCard key={i} event={e} className="h-full" />
          ))}
        </div>
        {tennis.length > 2 && (
          <OverflowLink count={tennis.length - 2} href="/perso/sports/tennis" />
        )}
      </div>
    );
  }

  // ── Mixed: football + tennis (F1 is in middle column on race day) ──
  return <MixedSportsSlot football={football} tennis={tennis} />;
}
