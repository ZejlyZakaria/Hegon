import Image from "next/image";
import Link from "next/link";
import type { DashboardSportEvent } from "../../types";

interface Props {
  event: DashboardSportEvent;
  className?: string;
}

export default function TennisNarrowCard({ event, className = "" }: Props) {
  // Tennis times stored as-is in DB — display in UTC to avoid conversion
  const time = event.date
    ? new Date(event.date).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : null;

  return (
    <Link
      href={event.href}
      className={`group relative overflow-hidden rounded-xl border border-amber-500/15 bg-zinc-950 hover:brightness-110 transition-all flex flex-col ${className}`}
    >
      {/* Amber radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 0% 0%, rgba(245,158,11,0.15), transparent)",
        }}
      />
      {/* Top specular line */}
      <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-amber-400/50 to-transparent" />

      <div className="relative flex flex-col flex-1 p-2.5 gap-1.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-black uppercase tracking-widest text-amber-400">
            TENNIS
          </span>
          <div className="relative w-8 h-3.5">
            <Image
              src="/assets/dashboard/ATP-white-logo.webp"
              alt="ATP"
              fill
              unoptimized
              className="object-contain object-right"
              style={{ opacity: 0.5 }}
            />
          </div>
        </div>

        {/* Player vs opponent */}
        <div className="flex-1 flex items-center gap-2">
          {/* Player photo */}
          {event.playerPhotoUrl ? (
            <div className="relative w-9 h-9 shrink-0 rounded-full overflow-hidden border border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <Image
                src={event.playerPhotoUrl}
                alt={event.playerName ?? ""}
                fill
                unoptimized
                className="object-cover object-top"
              />
            </div>
          ) : (
            <div className="w-9 h-9 shrink-0 rounded-full bg-zinc-800/80 border border-amber-500/20 flex items-center justify-center text-base">
              🎾
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white truncate leading-tight">
              {event.playerName}
            </p>
            <p className="text-[9px] text-zinc-500 truncate leading-tight">
              vs {event.opponentName}
            </p>
            {event.tournamentName && (
              <p className="text-[8px] text-zinc-600 truncate leading-tight mt-0.5">
                {event.tournamentName}
              </p>
            )}
          </div>
        </div>

        {/* Footer: round + time */}
        <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
          {event.round ? (
            <span className="text-[8px] font-bold uppercase tracking-wide text-amber-400/60">
              {event.round}
            </span>
          ) : (
            <span />
          )}
          {time && (
            <span className="text-[10px] font-semibold text-zinc-300 tabular-nums">{time}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
