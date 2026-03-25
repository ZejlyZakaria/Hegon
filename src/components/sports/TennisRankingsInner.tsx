"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export interface TennisRanking {
  player_id: string;
  rank: number;
  ranking_points: number | null;
  tennis_players: {
    id: string;
    name: string;
    country: string | null;
    photo_url: string | null;
  } | null;
}

interface TennisRankingsInnerProps {
  rankings: TennisRanking[];
  favoritePlayerIds: string[];
}

// ─── Avatar vide stylé ────────────────────────────────────────────────────────

function EmptyAvatar({ size = "sm" }: { size?: "sm" | "xs" }) {
  const dim = size === "sm" ? "w-8 h-8" : "w-5 h-5";
  const head = size === "sm" ? "w-3.5 h-3.5 mb-0.5" : "w-2.5 h-2.5 mb-px";
  const body = size === "sm" ? "w-6 h-3.5" : "w-4 h-2";
  return (
    <div
      className={`${dim} rounded-full overflow-hidden bg-linear-to-b from-zinc-700 to-zinc-800 flex flex-col items-center justify-end`}
    >
      <div className={`${head} rounded-full bg-zinc-500 shrink-0`} />
      <div className={`${body} rounded-t-full bg-zinc-500 shrink-0`} />
    </div>
  );
}

export default function TennisRankingsInner({
  rankings,
  favoritePlayerIds,
}: TennisRankingsInnerProps) {
  if (!rankings.length) return null;

  // hauteur d'une ligne ≈ 52px — 6 lignes = 312px
  const ROW_HEIGHT = 56;
  const VISIBLE_ROWS = 6;

  return (
    <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* header */}
      <div className="grid grid-cols-[2rem_1fr_4rem_5rem] items-center px-4 py-2.5 border-b border-zinc-800/60">
        <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
          #
        </span>
        <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
          Joueur
        </span>
        <span className="mr-3 text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-right">
          Pays
        </span>
        <span className="mr-2 text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-right">
          Points
        </span>
      </div>

      {/* rows — scroll après 6 lignes */}
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 custom-scrollbar"
        style={{ maxHeight: `${ROW_HEIGHT * VISIBLE_ROWS}px` }}
      >
        {rankings.map((r, i) => {
          const player = r.tennis_players;
          const isFav = favoritePlayerIds.includes(r.player_id);
          const isTop3 = r.rank <= 3;

          const rankColor =
            r.rank === 1
              ? "text-amber-400"
              : r.rank === 2
                ? "text-zinc-300"
                : r.rank === 3
                  ? "text-amber-600"
                  : "text-zinc-500";

          return (
            <motion.div
              key={r.player_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.15) }}
              className={`grid grid-cols-[2rem_1fr_4rem_5rem] items-center px-4 py-3 border-b border-zinc-800/40 last:border-0 transition-colors duration-150
                ${isFav ? "bg-amber-400/3" : "hover:bg-zinc-900/40"}`}
            >
              {/* rank */}
              <span className={`text-sm font-black tabular-nums ${rankColor}`}>
                {isTop3 ? (
                  <span className="text-base">
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                  </span>
                ) : (
                  r.rank
                )}
              </span>

              {/* player */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/50">
                  {player?.photo_url ? (
                    <Image
                      src={player.photo_url}
                      alt={player?.name ?? ""}
                      fill
                      className="object-cover object-top"
                      sizes="32px"
                    />
                  ) : (
                    <EmptyAvatar size="sm" />
                  )}
                </div>
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold truncate ${isFav ? "text-white" : "text-zinc-300"}`}
                  >
                    {player?.name ?? "—"}
                  </span>
                  {isFav && (
                    <span className="text-amber-400 text-[10px] shrink-0">
                      ★
                    </span>
                  )}
                </div>
              </div>

              {/* country */}
              <span className="text-zinc-500 text-xs text-right truncate">
                {player?.country ?? "—"}
              </span>

              {/* points */}
              <span
                className={`text-xs font-semibold text-right tabular-nums ${isFav ? "text-amber-400/80" : "text-zinc-500"}`}
              >
                {r.ranking_points ? r.ranking_points.toLocaleString() : "—"}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}