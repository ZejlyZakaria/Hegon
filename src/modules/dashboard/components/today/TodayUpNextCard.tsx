import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { SURFACE_CONFIGS } from "@/modules/sports/tennis/lib/tennis-utils";
import type { DashboardSportEvent } from "../../types";

// ─── Shared premium card wrapper ──────────────────────────────────────────────
// Radial glow from top-left corner — same pattern for all sport cards in Today

interface CardShellProps {
  event: DashboardSportEvent;
  glow: string;       // rgba(...) string for the radial glow color
  border: string;     // Tailwind border class
  accentLine: string; // Tailwind via-* class for top line
  children: React.ReactNode;
}

function CardShell({ event, glow, border, accentLine, children }: CardShellProps) {
  return (
    <Link
      href={event.href}
      className={`group relative overflow-hidden rounded-2xl border ${border} bg-zinc-950 hover:brightness-110 transition-all flex-1 flex flex-col min-h-30`}
    >
      {/* radial glow from top-left */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 0% 0%, ${glow}, transparent)` }}
      />
      {/* top specular line */}
      <div className={`absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent ${accentLine} to-transparent`} />
      <div className="relative flex flex-col flex-1 p-3 gap-2">
        {children}
      </div>
    </Link>
  );
}

// ─── Competition logo mapping (football) ─────────────────────────────────────

const COMPETITION_LOGO: Record<string, string> = {
  "UEFA Champions League": "/UEFA-logo.png",
  "Primera Division": "/LaLiga-logo.png",
  "Premier League": "/pl.png",
};

// ─── Football card ────────────────────────────────────────────────────────────

function FootballCard({ event, label }: { event: DashboardSportEvent; label: string }) {
  const competitionLogo = event.competition ? COMPETITION_LOGO[event.competition] ?? null : null;

  return (
    <CardShell
      event={event}
      glow="rgba(16,185,129,0.13)"
      border="border-emerald-500/15"
      accentLine="via-emerald-400/40"
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{label}</span>
        </div>
        {competitionLogo && (
          <div className="relative w-10 h-5">
            <Image src={competitionLogo} alt={event.competition ?? ""} fill unoptimized className="object-contain object-right" />
          </div>
        )}
      </div>

      {/* crests */}
      <div className="flex-1 flex items-center justify-center gap-3 w-full">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          {event.homeTeamCrest ? (
            <div className="relative w-10 h-10 shrink-0">
              <Image src={event.homeTeamCrest} alt={event.homeTeam ?? ""} fill unoptimized className="object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
          )}
          <span className="text-[9px] font-semibold text-zinc-300 text-center leading-tight line-clamp-2 w-full">{event.homeTeam}</span>
        </div>
        <span className="text-[11px] font-black text-zinc-600 shrink-0">VS</span>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          {event.awayTeamCrest ? (
            <div className="relative w-10 h-10 shrink-0">
              <Image src={event.awayTeamCrest} alt={event.awayTeam ?? ""} fill unoptimized className="object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
          )}
          <span className="text-[9px] font-semibold text-zinc-300 text-center leading-tight line-clamp-2 w-full">{event.awayTeam}</span>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] text-zinc-400">{event.subtitle}</span>
        {event.competition && (
          <span className="text-[10px] text-zinc-600 truncate max-w-[40%]">{event.competition}</span>
        )}
      </div>
    </CardShell>
  );
}

// ─── F1 card ──────────────────────────────────────────────────────────────────

function F1Card({ event, label }: { event: DashboardSportEvent; label: string }) {
  return (
    <CardShell
      event={event}
      glow="rgba(239,68,68,0.13)"
      border="border-red-500/15"
      accentLine="via-red-400/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{label}</span>
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-red-500/10 border-red-500/20 text-red-400">
          RACING
        </span>
      </div>

      <div className="flex-1 flex items-center">
        <div className="relative w-14 h-7">
          <Image src="/assets/dashboard/F1-white-logo.png" alt="F1" fill unoptimized className="object-contain object-left" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 pt-1.5 border-t border-white/5">
        <p className="text-sm font-bold text-white leading-snug">{event.title}</p>
        <p className="text-[10px] text-zinc-400">{event.subtitle}</p>
        {event.circuit && (
          <div className="flex items-center gap-1">
            <MapPin size={9} className="text-zinc-600" />
            <span className="text-[10px] text-zinc-500 truncate">{event.circuit}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ─── Tennis card ──────────────────────────────────────────────────────────────

function TennisCard({ event, label }: { event: DashboardSportEvent; label: string }) {
  const surfaceConfig = event.surface
    ? SURFACE_CONFIGS[event.surface as keyof typeof SURFACE_CONFIGS]
    : null;

  return (
    <CardShell
      event={event}
      glow="rgba(245,158,11,0.13)"
      border="border-amber-500/15"
      accentLine="via-amber-400/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{label}</span>
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/20 text-amber-400">
          TENNIS
        </span>
      </div>

      <div className="flex-1 flex items-center">
        <div className="relative w-14 h-7">
          <Image src="/assets/dashboard/ATP-white-logo.webp" alt="ATP" fill unoptimized className="object-contain object-left" />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 pt-1.5 border-t border-white/5">
        <p className="text-sm font-bold text-white leading-snug">{event.title}</p>
        <p className="text-[10px] text-zinc-400">{event.subtitle}</p>
        {surfaceConfig && (
          <span
            className="self-start text-[8px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{
              color: surfaceConfig.accent,
              borderColor: `${surfaceConfig.accent}40`,
              backgroundColor: `${surfaceConfig.accent}15`,
            }}
          >
            {surfaceConfig.label}
          </span>
        )}
      </div>
    </CardShell>
  );
}

// ─── Compact card (for stacked 2-sport layout) ────────────────────────────────

const COMPACT_CONFIG: Record<string, { glow: string; border: string; accent: string; line: string; badge: string }> = {
  football: { glow: "rgba(16,185,129,0.11)", border: "border-emerald-500/15", accent: "text-emerald-400", line: "via-emerald-400/35", badge: "FOOTBALL" },
  f1:       { glow: "rgba(239,68,68,0.11)",  border: "border-red-500/15",     accent: "text-red-400",     line: "via-red-400/35",     badge: "RACING"   },
  tennis:   { glow: "rgba(245,158,11,0.11)", border: "border-amber-500/15",  accent: "text-amber-400",   line: "via-amber-400/35",   badge: "TENNIS"   },
};

function CompactCard({ event }: { event: DashboardSportEvent }) {
  const cfg = COMPACT_CONFIG[event.type] ?? COMPACT_CONFIG.football;
  const title =
    event.type === "football"
      ? `${event.homeTeam ?? ""} vs ${event.awayTeam ?? ""}`
      : event.title;

  return (
    <Link
      href={event.href}
      className={`group relative overflow-hidden rounded-xl border ${cfg.border} bg-zinc-950 hover:brightness-110 transition-all flex-1 flex flex-col min-h-0`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 0% 0%, ${cfg.glow}, transparent)` }}
      />
      <div className={`absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent ${cfg.line} to-transparent`} />
      <div className="relative flex flex-col flex-1 p-2 gap-0.5">
        <span className={`text-[8px] font-bold uppercase tracking-widest ${cfg.accent}`}>{cfg.badge}</span>
        <p className="text-[11px] font-semibold text-white leading-snug line-clamp-1">{title}</p>
        <p className="text-[9px] text-zinc-500 truncate">{event.subtitle}</p>
      </div>
    </Link>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  event: DashboardSportEvent | null;
  label?: string;
  compact?: boolean;
}

export default function TodayUpNextCard({ event, label = "Up Next", compact = false }: Props) {
  if (compact && event) return <CompactCard event={event} />;
  if (event?.type === "football") return <FootballCard event={event} label={label} />;
  if (event?.type === "f1") return <F1Card event={event} label={label} />;
  if (event?.type === "tennis") return <TennisCard event={event} label={label} />;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950 min-h-30 flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-4">
        <div className="w-10 h-10 rounded-full bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-xl">📅</div>
        <p className="text-sm text-zinc-400 font-medium">No events today</p>
        <p className="text-xs text-zinc-600">Enjoy your day</p>
      </div>
    </div>
  );
}
