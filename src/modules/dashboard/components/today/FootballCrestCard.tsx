import Image from "next/image";
import Link from "next/link";
import type { DashboardSportEvent } from "../../types";

const COMPETITION_LOGO: Record<string, string> = {
  "UEFA Champions League": "/UEFA-logo.png",
  "Primera Division": "/LaLiga-logo.png",
  "Premier League": "/pl.png",
};

interface Props {
  event: DashboardSportEvent;
  className?: string;
}

export default function FootballCrestCard({ event, className = "" }: Props) {
  const competitionLogo = event.competition
    ? (COMPETITION_LOGO[event.competition] ?? null)
    : null;
  const time = new Date(event.date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return (
    <Link
      href={event.href}
      className={`group relative overflow-hidden rounded-xl border border-emerald-500/15 bg-zinc-950 hover:brightness-110 transition-all flex flex-col ${className}`}
    >
      {/* UCL background image + dark mask */}
      {event.competition === "UEFA Champions League" && (
        <>
          <Image
            src="/assets/dashboard/ucl-card-bg.png"
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/55" />
        </>
      )}
      {/* Emerald radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 0% 0%, rgba(16,185,129,0.18), transparent)",
        }}
      />
      {/* Top specular line */}
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-emerald-400/50 to-transparent" />

      <div className="relative flex flex-col flex-1 p-2.5">
        {/* ── Header: MAIN badge + competition logo ── */}
        <div className="flex items-center justify-between mb-1.5">
          {event.isMainTeam ? (
            <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
              MAIN
            </span>
          ) : (
            <span />
          )}
          <div className="w-6 h-6 shrink-0">
            <div className="relative w-full h-full">
              {competitionLogo ? (
                <Image
                  src={competitionLogo}
                  alt={event.competition ?? ""}
                  fill
                  unoptimized
                  className="object-contain opacity-80"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              ) : event.competition ? (
                <span className="text-[7px] text-zinc-600 truncate max-w-12">
                  {event.competition}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Crests + names: flex-1 so footer stays at bottom ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
          {/* Crests row — always aligned horizontally */}
          <div className="flex items-center justify-center gap-2 w-full">
            <div className="flex-1 flex justify-center">
              {event.homeTeamCrest ? (
                <div className="relative w-9 h-9 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                  <Image
                    src={event.homeTeamCrest}
                    alt={event.homeTeam ?? ""}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center text-base">
                  ⚽
                </div>
              )}
            </div>

            <span className="text-[10px] font-black text-zinc-600 shrink-0 select-none">
              VS
            </span>

            <div className="flex-1 flex justify-center">
              {event.awayTeamCrest ? (
                <div className="relative w-9 h-9 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                  <Image
                    src={event.awayTeamCrest}
                    alt={event.awayTeam ?? ""}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center text-base">
                  ⚽
                </div>
              )}
            </div>
          </div>

          {/* Names row — separate from crests, columns aligned via invisible VS spacer */}
          <div className="flex items-start justify-center gap-2 w-full">
            <p className="flex-1 text-[8px] font-semibold text-white/80 text-center leading-tight line-clamp-2">
              {event.homeTeam}
            </p>
            <span className="text-[10px] shrink-0 invisible select-none">
              VS
            </span>
            <p className="flex-1 text-[8px] font-semibold text-white/80 text-center leading-tight line-clamp-2">
              {event.awayTeam}
            </p>
          </div>
        </div>

        {/* ── Footer: time always pinned to bottom ── */}
        <div className="flex items-center justify-center pt-1.5 mt-1.5 border-t border-white/5">
          <span className="text-[10px] font-semibold text-zinc-300 tabular-nums">
            {time}
          </span>
        </div>
      </div>
    </Link>
  );
}
