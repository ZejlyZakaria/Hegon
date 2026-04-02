"use client";

import Image from "next/image";
import Link from "next/link";
import { Trophy, Calendar, MapPin, Zap, Flag } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { MOCK_FOOTBALL, MOCK_TENNIS, MOCK_F1 } from "@/lib/dashboard/mock-data";
import { SURFACE_CONFIGS } from "@/lib/utils/tennis-surface";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCountdown(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { label: "Live", urgent: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0 && hours === 0) return { label: "<1h", urgent: true };
  if (days === 0) return { label: `${hours}h`, urgent: true };
  if (days === 1) return { label: "Tomorrow", urgent: false };
  return { label: `${days}d`, urgent: false };
}

function formatMatchDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ icon, label, accent, href }: { icon: React.ReactNode; label: string; accent: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <Link href={href} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium">
        →
      </Link>
    </div>
  );
}

// ─── Football Card ─────────────────────────────────────────────────────────────

export function DashboardFootballCard() {
  const { nextMatch: m } = MOCK_FOOTBALL;
  const countdown = getCountdown(m.date);

  return (
    <div>
      <SectionLabel icon={<Trophy size={11} />} label="Football" accent="#10b981" href="/perso/sports/football" />

      <div className="relative rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
        {/* top accent line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        <div className="p-4">
          {/* competition + countdown */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {m.competition}
            </span>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full",
              countdown.urgent
                ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            )}>
              {countdown.label}
            </span>
          </div>

          {/* 1v1 */}
          <div className="flex items-center gap-2">
            {/* home */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="relative w-10 h-10">
                <Image
                  src={m.home_crest}
                  alt={m.home_team}
                  fill
                  unoptimized
                  className="object-contain drop-shadow-lg"
                />
                {m.is_home && (
                  <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl scale-150" />
                )}
              </div>
              <span className={cn(
                "text-[11px] font-bold leading-tight",
                m.is_home ? "text-white" : "text-zinc-400"
              )}>
                {m.home_team}
              </span>
            </div>

            {/* center */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px bg-zinc-700" />
                <span className="text-[9px] font-black tracking-widest text-zinc-500">VS</span>
                <div className="w-3 h-px bg-zinc-700" />
              </div>
              <div className="text-center">
                <p className="text-[10px] text-zinc-400 font-medium">{formatMatchDate(m.date)}</p>
                <p className="text-[9px] text-zinc-600">{formatTime(m.date)}</p>
              </div>
            </div>

            {/* away */}
            <div className="flex-1 flex flex-col items-center gap-2 text-center">
              <div className="relative w-10 h-10">
                <Image
                  src={m.away_crest}
                  alt={m.away_team}
                  fill
                  unoptimized
                  className="object-contain drop-shadow-lg"
                />
              </div>
              <span className="text-[11px] font-bold leading-tight text-zinc-400">
                {m.away_team}
              </span>
            </div>
          </div>

          {/* venue */}
          <div className="flex items-center justify-center gap-1 mt-3">
            <MapPin size={9} className="text-zinc-600" />
            <span className="text-[10px] text-zinc-600">{m.venue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tennis Card ───────────────────────────────────────────────────────────────

export function DashboardTennisCard() {
  const { nextMatch: m } = MOCK_TENNIS;
  const countdown = getCountdown(m.date);
  const surfaceConfig = SURFACE_CONFIGS[m.surface];

  return (
    <div>
      <SectionLabel icon={<Trophy size={11} />} label="Tennis" accent="#f59e0b" href="/perso/sports/tennis" />

      <div
        className="relative rounded-xl border border-zinc-800/60 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${surfaceConfig.bg.replace("linear-gradient(135deg, ", "").replace(")", "")})` }}
      >
        <div className="absolute inset-0 bg-zinc-950/70" />
        {/* top accent */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${surfaceConfig.accent}60, transparent)` }} />

        <div className="relative p-4">
          {/* tournament + surface */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{m.tournament}</p>
              <p className="text-[9px] text-zinc-600">{m.round}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  color: surfaceConfig.accent,
                  borderColor: `${surfaceConfig.accent}40`,
                  backgroundColor: `${surfaceConfig.accent}10`,
                }}
              >
                {surfaceConfig.label}
              </span>
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-full",
                countdown.urgent
                  ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-400"
              )}>
                {countdown.label}
              </span>
            </div>
          </div>

          {/* players 1v1 */}
          <div className="flex items-center gap-2">
            {/* player */}
            <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 flex items-center justify-center text-base" style={{ borderColor: `${surfaceConfig.accent}50` }}>
                🎾
              </div>
              <span className="text-[11px] font-bold text-white">{m.player}</span>
              <span className="text-[9px] text-zinc-500">{m.player_country}</span>
            </div>

            {/* center */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-px bg-zinc-700" />
                <span className="text-[9px] font-black tracking-widest text-zinc-500">VS</span>
                <div className="w-3 h-px bg-zinc-700" />
              </div>
              <p className="text-[10px] text-zinc-400 font-medium">{formatMatchDate(m.date)}</p>
            </div>

            {/* opponent */}
            <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-base">
                🎾
              </div>
              <span className="text-[11px] font-bold text-zinc-300">{m.opponent}</span>
              <span className="text-[9px] text-zinc-500">{m.opponent_country}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── F1 Card ───────────────────────────────────────────────────────────────────

export function DashboardF1Card() {
  const { nextRace: r } = MOCK_F1;
  const countdown = getCountdown(r.date);

  return (
    <div>
      <SectionLabel icon={<Zap size={11} />} label="Formula 1" accent="#ef4444" href="/perso/sports" />

      <div className="relative rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />

        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 uppercase tracking-wider">
                  Round {r.round}
                </span>
                <span className="text-[9px] text-zinc-600">{r.season}</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">{r.name}</p>
            </div>
            <span className={cn(
              "text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2",
              countdown.urgent
                ? "bg-red-500/10 border border-red-500/25 text-red-400"
                : "bg-zinc-800 border border-zinc-700 text-zinc-400"
            )}>
              {countdown.label}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/60">
            <span className="text-2xl">{r.country_flag}</span>
            <div>
              <p className="text-[11px] font-semibold text-zinc-300">{r.circuit}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Flag size={9} className="text-zinc-600" />
                <p className="text-[10px] text-zinc-600">{r.country} · {formatMatchDate(r.date)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
