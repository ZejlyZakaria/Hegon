"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TennisPastMatch {
  id: string;
  player_id: string;
  opponent_name: string;
  opponent_photo_url: string | null;
  match_date: string;
  score: string;
  result: "W" | "L";
  round: string | null;
  tournament_name?: string | null; 
}

export interface FollowedPlayer {
  id: string;
  name: string;
  photo_url: string | null;
  isMainPlayer: boolean;
}

interface TennisRecentResultsProps {
  matches: TennisPastMatch[];
  followedPlayers: FollowedPlayer[];
}

interface ParsedSet {
  player: number;
  opponent: number;
  tiebreak?: { player: number; opponent: number };
  display: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMatchDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ✅ Parser rounds (SF → Demi-finale, F → Finale, etc.)
function formatRound(round: string | null): string {
  if (!round) return "Tennis";

  const r = round.toUpperCase().trim();

  // Finals
  if (r === "F" || r === "FINAL") return "Final";
  if (r === "SF" || r === "SEMI-FINAL") return "Semi-Final";
  if (r === "QF" || r === "QUARTER-FINAL") return "Quarter-Final";

  // Numbered rounds
  const match = r.match(/(\d+)R/i);
  if (match) {
    const num = parseInt(match[1]);
    return `${num}${getOrdinalSuffix(num)} Round`;
  }

  return round;
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

// ✅ Parser scores avec tie-breaks
function parseScore(score: string): ParsedSet[] {
  if (!score) return [];

  // Map pour convertir chiffres en exposants Unicode
  const toSuperscript = (num: string): string => {
    const map: Record<string, string> = {
      "0": "⁰",
      "1": "¹",
      "2": "²",
      "3": "³",
      "4": "⁴",
      "5": "⁵",
      "6": "⁶",
      "7": "⁷",
      "8": "⁸",
      "9": "⁹",
    };
    return num
      .split("")
      .map((d) => map[d] || d)
      .join("");
  };

  const sets = score.split(",").map((s) => s.trim());

  return sets.map((set) => {
    // Détection tie-break (format: 63-7 ou 7-64)
    const tbMatch = set.match(/^(\d)(\d)-(\d)$|^(\d)-(\d)(\d)$/);

    if (tbMatch) {
      // Format: XY-Z (joueur a tie-break) → 6³-7
      if (tbMatch[1]) {
        const playerGames = tbMatch[1];
        const playerTB = tbMatch[2];
        const opponentGames = tbMatch[3];

        return {
          player: parseInt(playerGames),
          opponent: parseInt(opponentGames),
          tiebreak: { player: parseInt(playerTB), opponent: 0 },
          display: `${playerGames}${toSuperscript(playerTB)}-${opponentGames}`,
        };
      }

      // Format: X-YZ (adversaire a tie-break) → 6-7⁴
      if (tbMatch[4]) {
        const playerGames = tbMatch[4];
        const opponentGames = tbMatch[5];
        const opponentTB = tbMatch[6];

        return {
          player: parseInt(playerGames),
          opponent: parseInt(opponentGames),
          tiebreak: { player: 0, opponent: parseInt(opponentTB) },
          display: `${playerGames}-${opponentGames}${toSuperscript(opponentTB)}`,
        };
      }
    }

    // Set normal (6-4, 6-3, etc.)
    const normalMatch = set.match(/^(\d)-(\d)$/);
    if (normalMatch) {
      return {
        player: parseInt(normalMatch[1]),
        opponent: parseInt(normalMatch[2]),
        display: set,
      };
    }

    // Fallback si format inconnu
    return {
      player: 0,
      opponent: 0,
      display: set,
    };
  });
}

const RESULT_CONFIG = {
  W: {
    label: "W",
    pill: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    accent: "via-emerald-500/30",
    glow: "rgba(52,211,153,0.06)",
    scoreColor: "text-emerald-400",
  },
  L: {
    label: "L",
    pill: "bg-red-500/15 border-red-500/30 text-red-400",
    accent: "via-red-500/25",
    glow: "rgba(239,68,68,0.06)",
    scoreColor: "text-red-400",
  },
};

// ─── Match Card ───────────────────────────────────────────────────────────────

function TennisMatchCard({
  match,
  player,
  index,
}: {
  match: TennisPastMatch;
  player: FollowedPlayer;
  index: number;
}) {
  const config = RESULT_CONFIG[match.result];
  const parsedSets = parseScore(match.score);
  const formattedRound = formatRound(match.round);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.07 }}
      className="group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 hover:border-zinc-700/80 transition-all duration-300"
    >
      {/* hover glow — couleur selon résultat */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at top, ${config.glow}, transparent 70%)`,
        }}
      />

      {/* top accent */}
      <div
        className={`absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent ${config.accent} to-transparent`}
      />

      <div className="relative p-4 flex flex-col gap-4">
        {/* round + tournoi + badge */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-wider">
              {formattedRound}
            </span>
            {match.tournament_name && (
              <span className="text-zinc-600 text-[9px] font-medium truncate max-w-30">
                {match.tournament_name}
              </span>
            )}
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${config.pill}`}
          >
            {config.label}
          </span>
        </div>

        {/* joueur vs adversaire */}
        <div className="flex items-center gap-2">
          {/* joueur suivi */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-zinc-800">
              {player.photo_url ? (
                <>
                  <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-xl scale-150" />
                  <Image
                    src={player.photo_url}
                    alt={player.name}
                    fill
                    className="object-cover object-top relative z-10"
                    sizes="44px"
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-end bg-linear-to-b from-zinc-700 to-zinc-800 overflow-hidden">
                  <div className="w-5 h-5 rounded-full bg-zinc-500 mb-0.5 shrink-0" />
                  <div className="w-8 h-5 rounded-t-full bg-zinc-500 shrink-0" />
                </div>
              )}
            </div>
            {/* ✅ Nom complet */}
            <span className="text-[11px] font-semibold text-white leading-tight line-clamp-2 px-1">
              {player.name}
            </span>
          </div>

          {/* ✅ score parsé - une ligne avec wrap auto */}
          <div className="shrink-0 flex flex-col items-center gap-1 min-w-27.5">
            <div
              className={`px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800/80 ${config.scoreColor} flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 max-w-30`}
            >
              {parsedSets.map((set, i) => (
                <span
                  key={i}
                  className="text-sm font-black tabular-nums tracking-tight whitespace-nowrap"
                >
                  {set.display}
                  {i < parsedSets.length - 1 && ","}
                </span>
              ))}
            </div>
            <span className="text-zinc-600 text-[9px] uppercase tracking-widest font-semibold">
              Sets
            </span>
          </div>

          {/* adversaire */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11 rounded-full overflow-hidden bg-zinc-800">
              {match.opponent_photo_url ? (
                <Image
                  src={match.opponent_photo_url}
                  alt={match.opponent_name}
                  fill
                  className="object-cover object-top"
                  sizes="44px"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-end bg-linear-to-b from-zinc-700 to-zinc-800 overflow-hidden">
                  <div className="w-5 h-5 rounded-full bg-zinc-500 mb-0.5 shrink-0" />
                  <div className="w-8 h-5 rounded-t-full bg-zinc-500 shrink-0" />
                </div>
              )}
            </div>
            {/* ✅ Nom complet */}
            <span className="text-[11px] font-semibold text-zinc-400 leading-tight line-clamp-2 px-1">
              {match.opponent_name}
            </span>
          </div>
        </div>

        {/* date */}
        <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-center gap-2 text-zinc-500 text-xs">
          <Calendar size={11} />
          <span>{formatMatchDate(match.match_date)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Form Strip ───────────────────────────────────────────────────────────────

function FormStrip({
  matches,
  playerId,
}: {
  matches: TennisPastMatch[];
  playerId: string;
}) {
  const playerMatches = matches
    .filter((m) => m.player_id === playerId)
    .slice(0, 3);
  if (!playerMatches.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-600 text-[10px] font-semibold uppercase tracking-widest">
        Form
      </span>
      <div className="flex gap-1">
        {playerMatches.map((m, i) => {
          const config = RESULT_CONFIG[m.result];
          return (
            <div
              key={i}
              className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-black border ${config.pill}`}
            >
              {config.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TennisRecentResultsInner({
  matches,
  followedPlayers,
}: TennisRecentResultsProps) {
  const [activePlayerId, setActivePlayerId] = useState<string>(
    followedPlayers.find((p) => p.isMainPlayer)?.id ??
      followedPlayers[0]?.id ??
      "",
  );

  const activePlayer = followedPlayers.find((p) => p.id === activePlayerId);

  const filtered = matches
    .filter((m) => m.player_id === activePlayerId)
    .sort(
      (a, b) =>
        new Date(b.match_date).getTime() - new Date(a.match_date).getTime(),
    )
    .slice(0, 3);

  if (!followedPlayers.length || !matches.length) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 flex flex-col items-center gap-3 text-center">
        <div className="text-2xl">🎾</div>
        <p className="text-zinc-600 text-sm">No recent results</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* tabs joueurs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {followedPlayers.map((player) => {
            const isActive = player.id === activePlayerId;
            const count = matches.filter(
              (m) => m.player_id === player.id,
            ).length;
            return (
              <button
                key={player.id}
                onClick={() => setActivePlayerId(player.id)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 transition-all duration-200 border ${
                  isActive
                    ? "bg-zinc-800 border-zinc-700 text-white"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/60"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="tennis-results-tab-bg"
                    className="absolute inset-0 rounded-xl bg-zinc-800"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {player.photo_url ? (
                    <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0">
                      <Image
                        src={player.photo_url}
                        alt={player.name}
                        fill
                        className="object-cover"
                        sizes="20px"
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-700 flex flex-col items-center justify-end shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-zinc-500 mb-px shrink-0" />
                      <div className="w-4 h-2 rounded-t-full bg-zinc-500 shrink-0" />
                    </div>
                  )}
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {player.name}
                  </span>
                  {player.isMainPlayer && (
                    <span className="text-amber-400 text-[10px]">★</span>
                  )}
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-zinc-700 text-zinc-300"
                          : "bg-zinc-800 text-zinc-600"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <FormStrip matches={matches} playerId={activePlayerId} />
      </div>

      {/* cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePlayerId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 text-center text-zinc-600 text-sm">
              No recent results for this player
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((match, i) => (
                <TennisMatchCard
                  key={match.id}
                  match={match}
                  player={activePlayer!}
                  index={i}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
