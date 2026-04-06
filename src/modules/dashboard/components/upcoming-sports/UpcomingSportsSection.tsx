"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, CalendarX } from "lucide-react";
import { SURFACE_CONFIGS } from "@/modules/sports/tennis/lib/tennis-utils";
import type { DashboardSportEvent } from "../../types";

// ─── Config ───────────────────────────────────────────────────────────────────

const COMPETITION_BG: Record<string, string> = {
  "UEFA Champions League": "/assets/dashboard/ucl-card-bg.png",
};

const SPORT_BG: Record<string, string> = {
  football: "/assets/dashboard/football-card-bg.png",
  f1: "/assets/dashboard/f1-card-bg.webp",
  tennis: "/assets/dashboard/tennis-card-bg.webp",
};

const BADGE_STYLE: Record<string, string> = {
  football: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
  f1: "bg-red-500/15 border-red-500/25 text-red-400",
  tennis: "bg-amber-500/15 border-amber-500/25 text-amber-400",
};

const BADGE_LABEL: Record<string, string> = {
  football: "FOOTBALL",
  f1: "RACING",
  tennis: "TENNIS",
};

const SPORT_ORDER: Record<string, number> = { football: 0, tennis: 1, f1: 2 };

// ─── Sport card ───────────────────────────────────────────────────────────────

function SportCard({ event, isActive }: { event: DashboardSportEvent; isActive: boolean }) {
  const bgImage =
    event.type === "football" && event.competition && COMPETITION_BG[event.competition]
      ? COMPETITION_BG[event.competition]
      : SPORT_BG[event.type];

  const surfaceConfig =
    event.type === "tennis" && event.surface
      ? SURFACE_CONFIGS[event.surface.toLowerCase() as keyof typeof SURFACE_CONFIGS]
      : null;

  // Shared class for elements that reveal on hover
  const reveal = [
    "transition-[opacity,transform] duration-300 ease-in-out",
    isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none select-none",
  ].join(" ");

  return (
    <Link
      href={event.href}
      className="group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 hover:border-zinc-700 transition-colors flex flex-col h-full min-h-40"
    >
      <Image src={bgImage} alt="" fill unoptimized className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
      {surfaceConfig && (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom, ${surfaceConfig.accent}25, transparent 60%)` }}
        />
      )}

      <div className="relative flex flex-col flex-1 p-2.5 gap-1.5">

        {/* Badge — always visible */}
        <span className={`self-start text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${BADGE_STYLE[event.type]}`}>
          {BADGE_LABEL[event.type]}
        </span>

        {/* Main visual — always visible */}
        <div className="flex-1 flex items-center justify-start px-1">
          {event.type === "football" && (
            <div className="flex items-center justify-center gap-2 w-full">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {event.homeTeamCrest ? (
                  <div className="relative w-9 h-9 shrink-0">
                    <Image src={event.homeTeamCrest} alt={event.homeTeam ?? ""} fill unoptimized className="object-contain" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm">⚽</div>
                )}
                <span className="text-[9px] font-semibold text-zinc-300 text-center leading-tight truncate w-full px-1">
                  {event.homeTeam}
                </span>
              </div>
              <span className="text-[10px] font-black text-zinc-500 shrink-0">VS</span>
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {event.awayTeamCrest ? (
                  <div className="relative w-9 h-9 shrink-0">
                    <Image src={event.awayTeamCrest} alt={event.awayTeam ?? ""} fill unoptimized className="object-contain" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm">⚽</div>
                )}
                <span className="text-[9px] font-semibold text-zinc-300 text-center leading-tight truncate w-full px-1">
                  {event.awayTeam}
                </span>
              </div>
            </div>
          )}
          {event.type === "f1" && (
            <div className="relative w-14 h-7">
              <Image src="/assets/dashboard/F1-white-logo.png" alt="F1" fill unoptimized className="object-contain object-left" />
            </div>
          )}
          {event.type === "tennis" && (
            <div className="relative w-14 h-7">
              <Image src="/assets/dashboard/ATP-white-logo.webp" alt="ATP" fill unoptimized className="object-contain object-left" />
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="flex flex-col gap-0.5">

          {/* Title (non-football) — always visible */}
          {event.type !== "football" && (
            <p className="text-sm font-bold text-white truncate">{event.title}</p>
          )}

          {/* Subtitle (date / countdown) — reveal on hover, fixed height for cross-card alignment */}
          <div className={`h-4 flex items-center ${reveal}`}>
            <p className="text-[10px] text-zinc-400 leading-none">{event.subtitle}</p>
          </div>

          {/* Tennis: surface — reveal on hover, fixed height */}
          {event.type === "tennis" && surfaceConfig && (
            <div className={`h-4 flex items-center ${reveal}`}>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border"
                style={{
                  color: surfaceConfig.accent,
                  borderColor: `${surfaceConfig.accent}40`,
                  backgroundColor: `${surfaceConfig.accent}15`,
                }}
              >
                {surfaceConfig.label}
              </span>
            </div>
          )}

          {/* F1: circuit — reveal on hover, fixed height */}
          {event.type === "f1" && event.circuit && (
            <div className={`h-4 flex items-center ${reveal}`}>
              <div className="flex items-center gap-1">
                <MapPin size={9} className="text-zinc-600" />
                <span className="text-[10px] text-zinc-500 truncate">{event.circuit}</span>
              </div>
            </div>
          )}

          {/* Football: competition — reveal on hover */}
          {event.type === "football" && event.competition && (
            <div className={reveal}>
              <p className="text-[10px] text-zinc-600 truncate">{event.competition}</p>
            </div>
          )}

        </div>
      </div>
    </Link>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface Props {
  events: DashboardSportEvent[];
}

export default function UpcomingSportsSection({ events }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!events.length) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-3.5 rounded-full bg-emerald-400" />
            <h2 className="text-base font-semibold text-white tracking-tight">Upcoming in Sports</h2>
          </div>
          <Link href="/perso/sports/football" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            View all →
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/40 flex flex-col items-center justify-center py-8 gap-2">
          <CalendarX size={18} className="text-zinc-600" />
          <p className="text-sm text-zinc-500">No upcoming events</p>
        </div>
      </div>
    );
  }

  const seen = new Set<string>();
  const sortedEvents = [...events]
    .sort((a, b) => (SPORT_ORDER[a.type] ?? 99) - (SPORT_ORDER[b.type] ?? 99))
    .filter((e) => {
      if (seen.has(e.type)) return false;
      seen.add(e.type);
      return true;
    })
    .slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-0.5 h-3.5 rounded-full bg-emerald-400" />
          <h2 className="text-base font-semibold text-white tracking-tight">Upcoming in Sports</h2>
          <span className="text-xs text-zinc-500 italic">· your next events</span>
        </div>
        <Link href="/perso/sports/football" className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          View all →
        </Link>
      </div>

      <div
        className="flex gap-3"
        onMouseLeave={() => setActiveIndex(0)}
      >
        {sortedEvents.map((event, i) => (
          <div
            key={`${event.type}-${i}`}
            className="min-w-28"
            style={{
              flexGrow: activeIndex === i ? 45 : 27.5,
              flexShrink: 1,
              flexBasis: "0%",
              transition: "flex-grow 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <SportCard event={event} isActive={activeIndex === i} />
          </div>
        ))}
      </div>
    </div>
  );
}
