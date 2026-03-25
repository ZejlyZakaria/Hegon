"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { SURFACE_CONFIGS, type Surface } from "@/lib/utils/tennis-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentData {
  id: string;
  name: string;
  surface: string | null;
  start_date: string;
  end_date: string | null;
  country: string | null;
  level: string | null;
}

export interface PlayerInTournament {
  player: {
    id: string;
    name: string;
    photo_url: string | null;
    country: string | null;
  };
  rank: number | null;
  nextMatch: {
    match_date: string;
    opponent_name: string | null;
    round: string | null;
  } | null;
}

interface TennisUpcomingTournamentsProps {
  tournament: TournamentData | null;
  playersInTournament: PlayerInTournament[];
  isOngoing: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSurfaceType(dbSurface: string | null): Surface {
  if (!dbSurface) return "hard";
  
  const s = dbSurface.toLowerCase();
  
  if (s.includes("clay") || s.includes("terre")) return "clay";
  if (s.includes("grass") || s.includes("gazon")) return "grass";
  if (s.includes("indoor") || s.includes("intérieur") || s.includes("interieur")) return "indoor";
  if (s.includes("hard") || s.includes("dur")) return "hard";
  
  return "hard";
}

function formatDateRange(start: string, end: string | null) {
  const s = new Date(start).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

function formatMatchDate(dateStr: string) {
  const date = new Date(dateStr);
  const dateFormatted = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const timeFormatted = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateFormatted} à ${timeFormatted}`;
}

function getTier(name: string): string {
  const n = name.toLowerCase();
  if (
    n.includes("roland") ||
    n.includes("wimbledon") ||
    n.includes("us open") ||
    n.includes("australian")
  )
    return "GRAND SLAM";
  if (
    n.includes("miami") ||
    n.includes("madrid") ||
    n.includes("rome") ||
    n.includes("monte") ||
    n.includes("canadian") ||
    n.includes("cincinnati") ||
    n.includes("shanghai") ||
    n.includes("paris masters")
  )
    return "MASTERS 1000";
  if (n.includes("atp finals") || n.includes("nitto")) return "ATP FINALS";
  return "ATP TOUR";
}

function formatRound(round: string | null): string {
  if (!round) return "TBD";
  const match = round.match(/(\d+)R/i);
  if (match) {
    const num = match[1];
    return `${num} Round${parseInt(num) > 1 ? 's' : ''}`;
  }
  return round;
}

// ─── Court Lines SVG ──────────────────────────────────────────────────────────

function CourtLines({ color }: { color: string }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x="20"
        y="20"
        width="160"
        height="240"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <line x1="20" y1="80" x2="180" y2="80" stroke={color} strokeWidth="1" />
      <line x1="20" y1="200" x2="180" y2="200" stroke={color} strokeWidth="1" />
      <line x1="100" y1="80" x2="100" y2="200" stroke={color} strokeWidth="1" />
      <line
        x1="20"
        y1="140"
        x2="180"
        y2="140"
        stroke={color}
        strokeWidth="2.5"
      />
      <circle cx="20" cy="140" r="2.5" fill={color} />
      <circle cx="180" cy="140" r="2.5" fill={color} />
      <line x1="97" y1="20" x2="103" y2="20" stroke={color} strokeWidth="1.5" />
      <line
        x1="97"
        y1="260"
        x2="103"
        y2="260"
        stroke={color}
        strokeWidth="1.5"
      />
      <line
        x1="38"
        y1="20"
        x2="38"
        y2="260"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.6"
      />
      <line
        x1="162"
        y1="20"
        x2="162"
        y2="260"
        stroke={color}
        strokeWidth="0.8"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────────────

function TournamentCard({
  tournament,
  isOngoing,
}: {
  tournament: TournamentData;
  isOngoing: boolean;
}) {
  const surface = mapSurfaceType(tournament.surface);
  const config = SURFACE_CONFIGS[surface];
  const tier = getTier(tournament.name);

  return (
    <div
      className="relative overflow-hidden rounded-xl flex"
      style={{ border: `1px solid ${config.accent}50` }}
    >
      {/* LEFT — terrain */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width: "42%", background: config.bg }}
      >
        <CourtLines color="rgba(255,255,255,0.18)" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, transparent 55%, #09090b 100%)",
          }}
        />
      </div>
      {/* gradient transition */}
      <div
        className="absolute inset-y-0 z-10"
        style={{
          left: "calc(42% - 36px)",
          width: "72px",
          background: "linear-gradient(to right, transparent, #09090b)",
        }}
      />
      {/* RIGHT — infos */}
      <div className="relative z-20 flex flex-col justify-between p-4 flex-1 bg-[#09090b]">
        <div className="flex flex-col gap-1.5">
          {isOngoing && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                En cours
              </span>
            </div>
          )}
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full self-start"
            style={{
              backgroundColor: `${config.accent}25`,
              color: config.textAccent,
              border: `1px solid ${config.accent}50`,
            }}
          >
            {config.label.toUpperCase()}
          </span>
        </div>
        <h3 className="text-white font-black uppercase leading-none tracking-tight text-lg">
          {tournament.name}
        </h3>
        <div className="flex flex-col gap-0.5">
          <p className="text-zinc-400 text-[11px] font-medium">
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </p>
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            {tier}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State Card (aucun joueur inscrit) ──────────────────────────────────

function EmptyPlayerCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-950">
      <div className="relative p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-zinc-700 text-[11px] font-medium uppercase tracking-wider italic">
            Aucun joueur suivi inscrit
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="w-11 h-11 rounded-full bg-zinc-800/50 border border-zinc-700/20 flex items-center justify-center">
              <span className="text-zinc-700 text-lg">?</span>
            </div>
            <div className="w-10 h-2.5 rounded bg-zinc-800/50" />
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1 min-w-15">
            <div className="px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/40 w-14 h-8" />
            <div className="w-8 h-2 rounded bg-zinc-800/40" />
          </div>

          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="w-11 h-11 rounded-full bg-zinc-800/50 border border-zinc-700/20 flex items-center justify-center">
              <span className="text-zinc-700 text-lg">?</span>
            </div>
            <div className="w-10 h-2.5 rounded bg-zinc-800/50" />
          </div>
        </div>

        <div className="border-t border-zinc-800/40 pt-3 flex items-center justify-center gap-2">
          <div className="w-24 h-2.5 rounded bg-zinc-800/50" />
        </div>
      </div>
    </div>
  );
}

// ─── Player Match Card ────────────────────────────────────────────────────────

function PlayerMatchCard({
  item,
  index,
  tournament,
}: {
  item: PlayerInTournament;
  index: number;
  tournament: TournamentData;
}) {
  const { player, rank, nextMatch } = item;
  
  const surface = mapSurfaceType(tournament.surface);
  const surfaceConfig = SURFACE_CONFIGS[surface];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.07 }}
      className="group relative overflow-hidden rounded-xl bg-zinc-950 transition-all duration-300"
      style={{ 
        border: `1.5px solid ${surfaceConfig.accent}50`,
      }}
    >
      <div 
        className="absolute top-0 inset-x-0 h-0.5"
        style={{ 
          background: `linear-gradient(to right, transparent, ${surfaceConfig.accent}60, transparent)`,
          opacity: 1
        }}
      />

      <div 
        className="absolute inset-0 opacity-40 group-hover:opacity-100 transition-opacity duration-300"
        style={{ 
          background: `radial-gradient(ellipse at top, ${surfaceConfig.accent}18, transparent 70%)` 
        }} 
      />

      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ 
          boxShadow: `inset 0 0 20px ${surfaceConfig.accent}20, 0 0 15px ${surfaceConfig.accent}15`
        }} 
      />

      <div className="relative p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          {rank && (
            <span 
              className="text-[9px] font-black border px-1.5 py-0.5 rounded-full"
              style={{
                color: surfaceConfig.textAccent,
                borderColor: `${surfaceConfig.accent}50`,
                backgroundColor: `${surfaceConfig.accent}18`,
              }}
            >
              #{rank} ATP
            </span>
          )}
          <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-wider">
            {formatRound(nextMatch?.round ?? null)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-zinc-800">
              {player.photo_url ? (
                <>
                  <div 
                    className="absolute inset-0 rounded-full blur-xl scale-150"
                    style={{ backgroundColor: `${surfaceConfig.accent}25` }}
                  />
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    className="object-cover object-top relative z-10"
                    sizes="44px"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm">
                  🎾
                </div>
              )}
            </div>
            <span className="text-[11px] font-semibold text-white leading-tight line-clamp-2 px-1">
              {player.name}
            </span>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1 min-w-15">
            <div className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800/80 text-zinc-500">
              <span className="text-sm font-black">VS</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-zinc-900 border border-zinc-700/50 flex items-center justify-center">
              {nextMatch?.opponent_name ? (
                <span className="text-zinc-300 font-black text-base">
                  {nextMatch.opponent_name.charAt(0)}
                </span>
              ) : (
                <span className="text-zinc-600 font-black text-xl">?</span>
              )}
            </div>
            <span className="text-[11px] font-semibold text-zinc-400 leading-tight line-clamp-2 px-1">
              {nextMatch?.opponent_name ?? "TBD"}
            </span>
          </div>
        </div>

        <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-center gap-2 text-zinc-500 text-xs">
          <Calendar size={11} />
          <span>
            {nextMatch
              ? formatMatchDate(nextMatch.match_date)
              : "Date à confirmer"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 2;

export default function TennisUpcomingTournaments({
  tournament,
  playersInTournament,
  isOngoing,
}: TennisUpcomingTournamentsProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(
    1,
    Math.ceil(playersInTournament.length / CARDS_PER_PAGE),
  );
  const visiblePlayers = playersInTournament.slice(
    page * CARDS_PER_PAGE,
    (page + 1) * CARDS_PER_PAGE,
  );
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const hasPagination = playersInTournament.length > CARDS_PER_PAGE;

  if (!tournament) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 flex items-center justify-center">
        <p className="text-zinc-600 text-sm italic">Aucun tournoi à venir</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-zinc-600 text-xs">
          Joueurs suivis participant à ce tournoi
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!canPrev || !hasPagination}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
              canPrev && hasPagination
                ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600"
                : "border-zinc-800 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-zinc-600 text-[10px] font-semibold tabular-nums min-w-6 text-center">
            {hasPagination ? `${page + 1}/${totalPages}` : "—"}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!canNext || !hasPagination}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
              canNext && hasPagination
                ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600"
                : "border-zinc-800 text-zinc-700 cursor-not-allowed opacity-50"
            }`}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <TournamentCard tournament={tournament} isOngoing={isOngoing} />

        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            className="contents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {visiblePlayers.length > 0 ? (
              visiblePlayers.map((item, i) => (
                <PlayerMatchCard 
                  key={item.player.id} 
                  item={item} 
                  index={i}
                  tournament={tournament}
                />
              ))
            ) : (
              <EmptyPlayerCard />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}