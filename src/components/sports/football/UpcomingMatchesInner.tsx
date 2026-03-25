"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import { displayCompetition } from "@/lib/utils/football-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpcomingMatch {
  id: string;
  home_team_name: string;
  away_team_name: string;
  home_team_crest: string | null;
  away_team_crest: string | null;
  match_date: string;
  competition_name: string | null;
  competition_emblem_url: string | null;
  followed_team_id: string;
  followed_team_name: string;
  followed_team_crest: string | null;
}

export interface FollowedTeam {
  id: string;
  name: string;
  crest_url: string | null;
  isMainTeam: boolean;
}

interface UpcomingMatchesProps {
  matches: UpcomingMatch[];
  followedTeams: FollowedTeam[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatMatchDate(dateStr: string) {
  const date = new Date(dateStr);
  const now  = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === tomorrow.toDateString()) return "Demain";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getCountdown(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { label: "En cours", urgent: true };
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0 && hours === 0) return { label: "<1h", urgent: true };
  if (days === 0) return { label: `${hours}h`, urgent: true };
  return { label: `J-${days}`, urgent: false };
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ match, index }: { match: UpcomingMatch; index: number }) {
  const isHome   = match.home_team_name.toLowerCase().includes(match.followed_team_name.toLowerCase().split(" ")[0]);
  const countdown = getCountdown(match.match_date);
  const compName  = displayCompetition(match.competition_name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.07 }}
      className="group relative overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/80 hover:bg-zinc-900/60 transition-all duration-300"
    >
      {/* hover glow — bleu/violet pour prochains matchs */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.06),transparent_70%)]" />

      {/* top accent */}
      <div className={`absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent ${
        countdown.urgent ? "via-amber-400/60" : "via-indigo-500/30"
      } to-transparent`} />

      <div className="relative p-4 flex flex-col gap-4">

        {/* competition + countdown */}
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
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            countdown.urgent
              ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
              : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
          }`}>
            <Clock size={10} />
            {countdown.label}
          </div>
        </div>

        {/* teams */}
        <div className="flex items-center gap-2">
          {/* home */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11">
              {match.home_team_crest ? (
                <>
                  {isHome && <div className="absolute inset-0 bg-indigo-400/10 rounded-full blur-xl scale-150" />}
                  <Image src={match.home_team_crest} alt={match.home_team_name} fill className="object-contain relative z-10" />
                </>
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
              )}
            </div>
            <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${isHome ? "text-white" : "text-zinc-400"}`}>
              {match.home_team_name}
            </span>
            {isHome && (
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest -mt-1">Dom.</span>
            )}
          </div>

          {/* VS — avec date + heure au centre */}
          <div className="shrink-0 flex flex-col items-center gap-1.5 min-w-13">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-px bg-zinc-700" />
              <span className="text-zinc-500 text-[10px] font-black tracking-widest">VS</span>
              <div className="w-4 h-px bg-zinc-700" />
            </div>
            <div className="flex items-center gap-1 text-zinc-600 text-[10px]">
              <MapPin size={8} />
              <span>{isHome ? "Dom" : "Ext"}</span>
            </div>
          </div>

          {/* away */}
          <div className="flex-1 flex flex-col items-center gap-2 text-center">
            <div className="relative w-11 h-11">
              {match.away_team_crest ? (
                <>
                  {!isHome && <div className="absolute inset-0 bg-indigo-400/10 rounded-full blur-xl scale-150" />}
                  <Image src={match.away_team_crest} alt={match.away_team_name} fill className="object-contain relative z-10" />
                </>
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-base">⚽</div>
              )}
            </div>
            <span className={`text-[11px] font-semibold leading-tight line-clamp-2 ${!isHome ? "text-white" : "text-zinc-400"}`}>
              {match.away_team_name}
            </span>
            {!isHome && (
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest -mt-1">Ext.</span>
            )}
          </div>
        </div>

        {/* date + heure — mis en avant */}
        <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-center gap-2 text-xs">
          <span className="font-semibold text-zinc-300">{formatMatchDate(match.match_date)}</span>
          <span className="text-zinc-700">·</span>
          <Clock size={11} className="text-zinc-500" />
          <span className="text-zinc-400 font-medium">{formatTime(match.match_date)}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function UpcomingMatchesInner({ matches, followedTeams }: UpcomingMatchesProps) {
  const [activeTeamId, setActiveTeamId] = useState<string>(
    followedTeams.find(t => t.isMainTeam)?.id ?? followedTeams[0]?.id ?? "all"
  );

  const filtered = matches.filter(m => m.followed_team_id === activeTeamId);

  if (!followedTeams.length || !matches.length) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-2xl">📅</div>
        <p className="text-zinc-600 text-sm">Aucun match à venir</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
                <motion.div layoutId="team-filter-bg"
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

      <AnimatePresence mode="wait">
        <motion.div key={activeTeamId}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 text-center text-zinc-600 text-sm">
              Aucun match à venir pour cette équipe
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((match, i) => <MatchCard key={match.id} match={match} index={i} />)}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}