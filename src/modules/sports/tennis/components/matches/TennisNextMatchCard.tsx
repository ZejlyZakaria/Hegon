// components/sports/tennis/TennisNextMatchCard.tsx
"use client";

import { motion } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";
import { getSurface, SURFACE_CONFIGS } from "@/modules/sports/tennis/lib/tennis-utils"

interface TennisNextMatchCardProps {
  match: {
    match_date: string;
    opponent_name: string | null;
    round: string | null;
    tennis_tournaments?: { name: string; surface: string | null } | null;
  } | null;
  playerName: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === tomorrow.toDateString()) return "Demain";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Court lines SVG overlay
function CourtLines({ color }: { color: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-20"
      viewBox="0 0 300 180"
      preserveAspectRatio="none"
    >
      {/* outer boundary */}
      <rect
        x="10"
        y="10"
        width="280"
        height="160"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* center line */}
      <line x1="150" y1="10" x2="150" y2="170" stroke={color} strokeWidth="1" />
      {/* service boxes */}
      <line x1="10" y1="85" x2="290" y2="85" stroke={color} strokeWidth="1" />
      <line x1="65" y1="10" x2="65" y2="85" stroke={color} strokeWidth="1" />
      <line x1="235" y1="10" x2="235" y2="85" stroke={color} strokeWidth="1" />
      <line x1="65" y1="95" x2="65" y2="170" stroke={color} strokeWidth="1" />
      <line x1="235" y1="95" x2="235" y2="170" stroke={color} strokeWidth="1" />
    </svg>
  );
}

export default function TennisNextMatchCard({
  match,
  playerName,
}: TennisNextMatchCardProps) {
  const tournamentName = match?.tennis_tournaments?.name ?? null;
  const surface = getSurface(tournamentName);
  const config = SURFACE_CONFIGS[surface];

  if (!match) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-800/60 p-4 flex items-center justify-center"
        style={{ background: SURFACE_CONFIGS.unknown.bg, minHeight: "140px" }}
      >
        <CourtLines color={SURFACE_CONFIGS.unknown.lines} />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
        <p className="relative z-10 text-zinc-500 text-xs text-center italic">
          No upcoming matches
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border transition-all duration-200"
      style={{
        background: config.bg,
        borderColor: `${config.accent}40`,
        minHeight: "140px",
      }}
    >
      {/* court lines */}
      <CourtLines color={config.lines} />

      {/* gradient mask */}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-black/60 via-transparent to-transparent" />

      {/* surface badge */}
      <div className="absolute top-3 right-3">
        <span
          className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${config.accent}25`,
            color: config.textAccent,
            border: `1px solid ${config.accent}40`,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* content */}
      <div
        className="relative z-10 p-4 flex flex-col justify-end h-full"
        style={{ minHeight: "140px" }}
      >
        {/* tournament */}
        {tournamentName && (
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: config.textAccent }}
          >
            {tournamentName}
          </p>
        )}

        {/* matchup */}
        <div className="mb-2">
          <p className="text-white text-sm font-black leading-tight">
            {playerName.split(" ").slice(-1)[0]}
            <span className="text-zinc-500 font-normal mx-2">vs</span>
            <span
              style={{
                color: match.opponent_name ? "white" : config.textAccent,
              }}
            >
              {match.opponent_name || "TBD"}
            </span>
          </p>
          {match.round && (
            <p className="text-zinc-400 text-[10px] mt-0.5">{match.round}</p>
          )}
        </div>

        {/* date + time */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-400">
          <div className="flex items-center gap-1">
            <Calendar size={10} style={{ color: config.textAccent }} />
            <span
              className="font-semibold"
              style={{ color: config.textAccent }}
            >
              {formatDate(match.match_date)}
            </span>
          </div>
          <span className="text-zinc-700">·</span>
          <span>{formatTime(match.match_date)}</span>
          {match.tennis_tournaments?.surface && (
            <>
              <span className="text-zinc-700">·</span>
              <div className="flex items-center gap-1">
                <MapPin size={9} />
                <span>{match.tennis_tournaments.surface}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
