"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "lucide-react";
import { displayCompetition, formatMatchDate } from "@/lib/utils/football-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PastMatch {
  id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_crest: string | null;
  away_team_crest: string | null;
  match_date: string;
  home_score: number;
  away_score: number;
  competition_name: string | null;
  competition_emblem_url: string | null;
  followed_team_id: string;
  followed_team_name: string;
}

export interface FollowedTeamResult {
  id: string;
  name: string;
  crest_url: string | null;
  isMainTeam: boolean;
}

interface RecentResultsProps {
  matches: PastMatch[];
  followedTeams: FollowedTeamResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Result = "W" | "D" | "L";

function getResult(match: PastMatch): Result {
  const isHome = match.home_team_name
    .toLowerCase()
    .includes(match.followed_team_name.toLowerCase().split(" ")[0]);
  const teamScore = isHome ? match.home_score : match.away_score;
  const oppScore  = isHome ? match.away_score : match.home_score;
  if (teamScore > oppScore) return "W";
  if (teamScore === oppScore) return "D";
  return "L";
}

const RESULT_CONFIG = {
  W: {
    label: "V",
    pill: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    accent: "via-emerald-500/30",
    glow: "rgba(52,211,153,0.06)",
    scoreColor: "text-emerald-400",
  },
  D: {
    label: "N",
    pill: "bg-zinc-700/40 border-zinc-600/30 text-zinc-400",
    accent: "via-zinc-500/20",
    glow: "rgba(113,113,122,0.04)",
    scoreColor: "text-zinc-300",
  },
  L: {
    label: "D",
    pill: "bg-red-500/15 border-red-500/30 text-red-400",
    accent: "via-red-500/25",
    glow: "rgba(239,68,68,0.06)",
    scoreColor: "text-red-400",
  },
};

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ match, index }: { match: PastMatch; index: number }) {
  const isHome = match.home_team_name
    .toLowerCase()
    .includes(match.followed_team_name.toLowerCase().split(" ")[0]);

  const result  = getResult(match);
  const config  = RESULT_CONFIG[result];
  const compName = displayCompetition(match.competition_name);

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
        style={{ background: `radial-gradient(ellipse at top, ${config.glow}, transparent 70%)` }}
      />

      {/* top accent — couleur selon résultat */}
      <div className={`absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent ${config.accent} to-transparent`} />

      <div className="relative p-4 flex flex-col gap-4">

        {/* competition + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {match.competition_emblem_url && (
              <div className="w-6 h-6 shrink-0 bg-white rounded-sm p-1 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <Image src={match.competition_emblem_url} alt={compName} fill className="object-contain" />
                </div>
              </div>
            )}
            <span className="text-zinc-500 text-[11px] font-medium uppercase tracking-wider">{compName}</span>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${config.pill}`}>
            {config.label}
          </span>
        </div>

        {/* teams + score */}
        <div className="flex items-center gap-2">
          {/* home */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11">
              {match.home_team_crest ? (
                <>
                  {isHome && <div className="absolute inset-0 bg-emerald-400/10 rounded-full blur-xl scale-150" />}
                  <Image src={match.home_team_crest} alt={match.home_team_name} fill className="object-contain relative z-10" />
                </>
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
              )}
            </div>
            <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${isHome ? "text-white" : "text-zinc-400"}`}>
              {match.home_team_name}
            </span>
          </div>

          {/* score — impactant avec couleur selon résultat */}
          <div className="shrink-0 flex flex-col items-center gap-1 min-w-13">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800/80 ${config.scoreColor}`}>
              <span className="text-2xl font-black tabular-nums tracking-tight">{match.home_score}</span>
              <span className="text-zinc-700 text-lg font-bold">-</span>
              <span className="text-2xl font-black tabular-nums tracking-tight">{match.away_score}</span>
            </div>
            <span className="text-zinc-600 text-[9px] uppercase tracking-widest font-semibold">
              {isHome ? "Dom." : "Ext."}
            </span>
          </div>

          {/* away */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11">
              {match.away_team_crest ? (
                <>
                  {!isHome && <div className="absolute inset-0 bg-emerald-400/10 rounded-full blur-xl scale-150" />}
                  <Image src={match.away_team_crest} alt={match.away_team_name} fill className="object-contain relative z-10" />
                </>
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
              )}
            </div>
            <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${!isHome ? "text-white" : "text-zinc-400"}`}>
              {match.away_team_name}
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

// ─── Forme strip ──────────────────────────────────────────────────────────────

function FormStrip({ matches, followedTeamId }: { matches: PastMatch[]; followedTeamId: string }) {
  const teamMatches = matches.filter(m => m.followed_team_id === followedTeamId).slice(0, 3);
  if (!teamMatches.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-600 text-[10px] font-semibold uppercase tracking-widest">Forme</span>
      <div className="flex gap-1">
        {teamMatches.map((m, i) => {
          const r = getResult(m);
          return (
            <div key={i} title={RESULT_CONFIG[r].label}
              className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-black ${RESULT_CONFIG[r].pill}`}>
              {RESULT_CONFIG[r].label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RecentResultsInner({ matches, followedTeams }: RecentResultsProps) {
  const [activeTeamId, setActiveTeamId] = useState<string>(
    followedTeams.find(t => t.isMainTeam)?.id ?? followedTeams[0]?.id ?? ""
  );

  const filtered = matches
    .filter(m => m.followed_team_id === activeTeamId)
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    .slice(0, 3);

  if (!followedTeams.length || !matches.length) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-2xl">📋</div>
        <p className="text-zinc-600 text-sm">Aucun résultat récent</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {followedTeams.map(team => {
            const isActive = team.id === activeTeamId;
            const count = matches.filter(m => m.followed_team_id === team.id).length;
            return (
              <button key={team.id} onClick={() => setActiveTeamId(team.id)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 transition-all duration-200 border ${
                  isActive
                    ? "bg-zinc-800 border-zinc-700 text-white"
                    : "bg-zinc-950 border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700/60"
                }`}>
                {isActive && (
                  <motion.div layoutId="results-team-filter-bg"
                    className="absolute inset-0 rounded-xl bg-zinc-800"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.35 }} />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {team.crest_url && (
                    <div className="relative w-5 h-5 shrink-0">
                      <Image src={team.crest_url} alt={team.name} fill className="object-contain" />
                    </div>
                  )}
                  <span className="text-xs font-semibold whitespace-nowrap">{team.name}</span>
                  {team.isMainTeam && <span className="text-emerald-400 text-[10px]">★</span>}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800 text-zinc-600"
                    }`}>{count}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <FormStrip matches={matches} followedTeamId={activeTeamId} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTeamId}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 text-center text-zinc-600 text-sm">
              Aucun résultat récent pour cette équipe
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((match, i) => <ResultCard key={match.id} match={match} index={i} />)}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}