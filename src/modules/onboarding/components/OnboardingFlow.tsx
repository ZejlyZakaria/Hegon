/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Plus,
  Check,
  Loader2,
  Shield,
  Trophy,
  Film,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedTeam {
  id: string;
  name: string;
  crest_url: string | null;
}

interface SelectedPlayer {
  id: string;
  name: string;
  country: string | null;
  photo_url: string | null;
}

interface SelectedMedia {
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  type: "film" | "serie";
}

interface FootballTeam {
  id: string;
  name: string;
  crest_url: string | null;
  api_external_id: string;
}

interface SportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string | null;
  strThumb: string | null;
  strCutout: string | null;
  strSport: string | null;
  dateBorn: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFlagEmoji(country: string | null): string {
  if (!country) return "🌍";
  const flags: Record<string, string> = {
    Serbia: "🇷🇸", Spain: "🇪🇸", Switzerland: "🇨🇭",
    Russia: "🇷🇺", Greece: "🇬🇷", Germany: "🇩🇪",
    Italy: "🇮🇹", Norway: "🇳🇴", Denmark: "🇩🇰",
    "United Kingdom": "🇬🇧", France: "🇫🇷", Australia: "🇦🇺",
    "United States": "🇺🇸", Canada: "🇨🇦", Argentina: "🇦🇷",
    Bulgaria: "🇧🇬", Poland: "🇵🇱", Croatia: "🇭🇷",
    Austria: "🇦🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪",
    "Czech Republic": "🇨🇿", Hungary: "🇭🇺", Portugal: "🇵🇹",
  };
  return flags[country] ?? "🌍";
}

// ─── Progress Indicator ───────────────────────────────────────────────────────

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{
            width: i === step ? 24 : 6,
            backgroundColor:
              i < step
                ? "rgba(113,113,122,0.6)"
                : i === step
                  ? "#ffffff"
                  : "rgba(39,39,42,1)",
          }}
          transition={{ duration: 0.3 }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ─── Live Preview Panel ───────────────────────────────────────────────────────

function PreviewPanel({
  teams,
  players,
  media,
}: {
  teams: SelectedTeam[];
  players: SelectedPlayer[];
  media: SelectedMedia[];
}) {
  return (
    <div className="w-full space-y-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 text-center">
        Your dashboard preview
      </p>

      {/* Football */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
          Football
        </p>
        <div className="flex flex-wrap gap-2 min-h-8">
          <AnimatePresence>
            {teams.length === 0 ? (
              <span className="text-xs text-zinc-700 italic">No teams yet</span>
            ) : (
              teams.map((team) => (
                <motion.div
                  key={team.id}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  {team.crest_url ? (
                    <div className="relative w-4 h-4 shrink-0">
                      <Image
                        src={team.crest_url}
                        alt={team.name}
                        fill
                        className="object-contain"
                        sizes="16px"
                      />
                    </div>
                  ) : (
                    <Shield size={11} className="text-emerald-500 shrink-0" />
                  )}
                  <span className="truncate max-w-24">{team.name}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tennis */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
          Tennis
        </p>
        <div className="flex flex-wrap gap-2 min-h-8">
          <AnimatePresence>
            {players.length === 0 ? (
              <span className="text-xs text-zinc-700 italic">No players yet</span>
            ) : (
              players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  <div className="relative w-4 h-4 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                    {player.photo_url ? (
                      <Image
                        src={player.photo_url}
                        alt={player.name}
                        fill
                        className="object-cover"
                        sizes="16px"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-700" />
                    )}
                  </div>
                  <span className="truncate max-w-24">{player.name}</span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Watching */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">
          Watching
        </p>
        <div className="flex gap-2 flex-wrap min-h-10">
          <AnimatePresence>
            {media.length === 0 ? (
              <span className="text-xs text-zinc-700 italic">No titles yet</span>
            ) : (
              media.map((m) => (
                <motion.div
                  key={m.tmdb_id}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="relative w-10 h-14 rounded-md overflow-hidden border border-zinc-800 shrink-0"
                >
                  {m.poster_url ? (
                    <Image
                      src={m.poster_url}
                      alt={m.title}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <Film size={14} className="text-zinc-700" />
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          Tasks
        </p>
        <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 flex items-center gap-1.5">
          <Check size={11} className="text-zinc-600" />
          Workspace ready
        </div>
      </div>
    </div>
  );
}

// ─── Step 0: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ userName }: { userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="text-center max-w-md w-full"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
        className="flex justify-center mb-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-white/5 rounded-3xl blur-2xl scale-150" />
          <Image
            src="/logo/Hegon_white_logo.png"
            alt="HEGON"
            width={72}
            height={72}
            className="relative drop-shadow-2xl"
          />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3"
      >
        Welcome, {userName}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="text-5xl md:text-6xl font-black tracking-tight text-white mb-4 leading-none"
      >
        Make it yours.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.4 }}
        className="text-zinc-400 text-lg leading-relaxed mb-2"
      >
        Your sports, your watchlist, your tasks.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="text-zinc-600 text-sm mb-10"
      >
        Set it up in under 2 minutes.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="flex items-center justify-center gap-4"
      >
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Sparkles size={12} className="text-zinc-600" />
          2 steps
        </div>
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Check size={12} className="text-zinc-600" />
          All skippable
        </div>
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <CheckCircle2 size={12} className="text-zinc-600" />
          Never shown again
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Step 1: Sports ───────────────────────────────────────────────────────────

function SportsStep({
  userId,
  onTeamsChange,
  onPlayersChange,
}: {
  userId: string;
  onTeamsChange: (teams: SelectedTeam[]) => void;
  onPlayersChange: (players: SelectedPlayer[]) => void;
}) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<"football" | "tennis">("football");

  // Football
  const [fbQuery, setFbQuery] = useState("");
  const [fbResults, setFbResults] = useState<FootballTeam[]>([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbAddingId, setFbAddingId] = useState<string | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([]);
  const fbDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tennis
  const [tnQuery, setTnQuery] = useState("");
  const [tnResults, setTnResults] = useState<SportsDBPlayer[]>([]);
  const [tnLoading, setTnLoading] = useState(false);
  const [tnAddingId, setTnAddingId] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const tnDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Football ────────────────────────────────────────────────────────────────
  const searchTeams = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) { setFbResults([]); return; }
      setFbLoading(true);
      try {
        const { data } = await supabase
          .schema("sport")
          .from("football_teams")
          .select("id, name, crest_url, api_external_id")
          .ilike("name", `%${q}%`)
          .limit(6);
        setFbResults(data ?? []);
      } catch { /* ignore */ } finally {
        setFbLoading(false);
      }
    },
    [supabase],
  );

  const handleFbQuery = (val: string) => {
    setFbQuery(val);
    if (fbDebounce.current) clearTimeout(fbDebounce.current);
    fbDebounce.current = setTimeout(() => searchTeams(val), 350);
  };

  const handleAddTeam = async (team: FootballTeam) => {
    if (selectedTeams.find((t) => t.id === team.id)) return;
    setFbAddingId(team.id);
    try {
      const orgId = await getCurrentOrgId();
      await supabase.schema("sport").from("user_favorites").insert({
        user_id: userId,
        entity_type: "football_team",
        entity_id: team.id,
        org_id: orgId,
      });
      const updated = [
        ...selectedTeams,
        { id: team.id, name: team.name, crest_url: team.crest_url },
      ];
      setSelectedTeams(updated);
      onTeamsChange(updated);
    } catch { /* ignore */ } finally {
      setFbAddingId(null);
    }
  };

  const removeTeam = (id: string) => {
    const updated = selectedTeams.filter((t) => t.id !== id);
    setSelectedTeams(updated);
    onTeamsChange(updated);
  };

  // ── Tennis ──────────────────────────────────────────────────────────────────
  const searchPlayers = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setTnResults([]); return; }
    setTnLoading(true);
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setTnResults(
        (data?.player ?? [])
          .filter((p: SportsDBPlayer) => p.strSport === "Tennis")
          .slice(0, 6),
      );
    } catch { /* ignore */ } finally {
      setTnLoading(false);
    }
  }, []);

  const handleTnQuery = (val: string) => {
    setTnQuery(val);
    if (tnDebounce.current) clearTimeout(tnDebounce.current);
    tnDebounce.current = setTimeout(() => searchPlayers(val), 400);
  };

  const handleAddPlayer = async (player: SportsDBPlayer) => {
    if (selectedPlayers.find((p) => p.id === player.idPlayer)) return;
    setTnAddingId(player.idPlayer);
    try {
      const res = await fetch("/api/tennis/add-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idPlayer: player.idPlayer,
          strPlayer: player.strPlayer,
          strNationality: player.strNationality,
          strThumb: player.strThumb,
          strCutout: player.strCutout,
          dateBorn: player.dateBorn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = [
        ...selectedPlayers,
        {
          id: data.playerUUID,
          name: player.strPlayer,
          country: player.strNationality ?? null,
          photo_url: player.strThumb ?? player.strCutout ?? null,
        },
      ];
      setSelectedPlayers(updated);
      onPlayersChange(updated);
    } catch { /* ignore */ } finally {
      setTnAddingId(null);
    }
  };

  const removePlayer = (id: string) => {
    const updated = selectedPlayers.filter((p) => p.id !== id);
    setSelectedPlayers(updated);
    onPlayersChange(updated);
  };

  const totalSelected = selectedTeams.length + selectedPlayers.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-lg"
    >
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white mb-1">Who do you follow?</h2>
        <p className="text-zinc-500 text-sm">
          Add teams and players to track upcoming matches.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800/60 mb-4">
        {(["football", "tennis"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "football" ? (
              <Shield size={13} />
            ) : (
              <Trophy size={13} />
            )}
            <span className="capitalize">{tab}</span>
            {tab === "football" && selectedTeams.length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center">
                {selectedTeams.length}
              </span>
            )}
            {tab === "tennis" && selectedPlayers.length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                {selectedPlayers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "football" ? (
          <motion.div
            key="football"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Search */}
            <div className="relative flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all mb-3">
              {fbLoading ? (
                <Loader2 size={14} className="text-zinc-500 animate-spin shrink-0" />
              ) : (
                <Search size={14} className="text-zinc-500 shrink-0" />
              )}
              <input
                value={fbQuery}
                onChange={(e) => handleFbQuery(e.target.value)}
                placeholder="Barcelona, Real Madrid, PSG..."
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
              />
              {fbQuery && (
                <button
                  onClick={() => { setFbQuery(""); setFbResults([]); }}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none">
              {!fbLoading && !fbResults.length && fbQuery.length >= 2 && (
                <p className="text-center text-zinc-600 text-sm py-4">
                  No team found for &quot;{fbQuery}&quot;
                </p>
              )}
              {!fbQuery && (
                <p className="text-center text-zinc-700 text-xs py-4">
                  Type at least 2 characters to search
                </p>
              )}
              {fbResults.map((team, i) => {
                const isAdded = !!selectedTeams.find((t) => t.id === team.id);
                const isAdding = fbAddingId === team.id;
                return (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                      isAdded
                        ? "bg-emerald-500/5 border border-emerald-500/20"
                        : "hover:bg-zinc-900 border border-transparent hover:border-zinc-800 cursor-pointer"
                    }`}
                    onClick={() => !isAdded && !isAdding && handleAddTeam(team)}
                  >
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                      {team.crest_url ? (
                        <div className="relative w-7 h-7">
                          <Image
                            src={team.crest_url}
                            alt={team.name}
                            fill
                            className="object-contain"
                            sizes="28px"
                          />
                        </div>
                      ) : (
                        <Shield size={18} className="text-emerald-400" />
                      )}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-white truncate">
                      {team.name}
                    </p>
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                        isAdded
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : isAdding
                            ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                            : "bg-zinc-900 border-zinc-700 text-zinc-500 group-hover:border-emerald-500/40"
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isAdded ? (
                        <Check size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Selected chips */}
            {selectedTeams.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                  Added ({selectedTeams.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                    >
                      {team.crest_url ? (
                        <div className="relative w-3.5 h-3.5 shrink-0">
                          <Image
                            src={team.crest_url}
                            alt={team.name}
                            fill
                            className="object-contain"
                            sizes="14px"
                          />
                        </div>
                      ) : (
                        <Shield size={10} className="text-emerald-400 shrink-0" />
                      )}
                      <span className="max-w-30 truncate">{team.name}</span>
                      <button
                        onClick={() => removeTeam(team.id)}
                        className="text-zinc-600 hover:text-zinc-400 ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="tennis"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Search */}
            <div className="relative flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all mb-3">
              {tnLoading ? (
                <Loader2 size={14} className="text-zinc-500 animate-spin shrink-0" />
              ) : (
                <Search size={14} className="text-zinc-500 shrink-0" />
              )}
              <input
                value={tnQuery}
                onChange={(e) => handleTnQuery(e.target.value)}
                placeholder="Djokovic, Alcaraz, Sinner..."
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
              />
              {tnQuery && (
                <button
                  onClick={() => { setTnQuery(""); setTnResults([]); }}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Results */}
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none">
              {!tnLoading && !tnResults.length && tnQuery.length >= 2 && (
                <p className="text-center text-zinc-600 text-sm py-4">
                  No player found for &quot;{tnQuery}&quot;
                </p>
              )}
              {!tnQuery && (
                <p className="text-center text-zinc-700 text-xs py-4">
                  Type at least 2 characters to search
                </p>
              )}
              {tnResults.map((player, i) => {
                const isAdded = !!selectedPlayers.find((p) => p.id === player.idPlayer);
                const isAdding = tnAddingId === player.idPlayer;
                const photoUrl = player.strThumb ?? player.strCutout;
                return (
                  <motion.div
                    key={player.idPlayer}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                      isAdded
                        ? "bg-amber-500/5 border border-amber-500/20"
                        : "hover:bg-zinc-900 border border-transparent hover:border-zinc-800 cursor-pointer"
                    }`}
                    onClick={() => !isAdded && !isAdding && handleAddPlayer(player)}
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/50">
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={player.strPlayer}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-end overflow-hidden">
                          <div className="w-3 h-3 rounded-full bg-zinc-500 mb-0.5 shrink-0" />
                          <div className="w-6 h-3 rounded-t-full bg-zinc-500 shrink-0" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {player.strPlayer}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {getFlagEmoji(player.strNationality)}{" "}
                        {player.strNationality ?? "Unknown"}
                      </p>
                    </div>
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                        isAdded
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : isAdding
                            ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                            : "bg-zinc-900 border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isAdded ? (
                        <Check size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Selected chips */}
            {selectedPlayers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/60">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                  Added ({selectedPlayers.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                    >
                      <div className="relative w-3.5 h-3.5 rounded-full overflow-hidden bg-zinc-700 shrink-0">
                        {player.photo_url && (
                          <Image
                            src={player.photo_url}
                            alt={player.name}
                            fill
                            className="object-cover"
                            sizes="14px"
                          />
                        )}
                      </div>
                      <span className="max-w-30 truncate">{player.name}</span>
                      <button
                        onClick={() => removePlayer(player.id)}
                        className="text-zinc-600 hover:text-zinc-400 ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {totalSelected > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs text-zinc-600 text-center"
        >
          {totalSelected} item{totalSelected > 1 ? "s" : ""} added — you can always change this later
        </motion.p>
      )}
    </motion.div>
  );
}

// ─── Step 2: Watching ─────────────────────────────────────────────────────────

function WatchingStep({
  userId,
  onMediaChange,
}: {
  userId: string;
  onMediaChange: (media: SelectedMedia[]) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchTMDB = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tmdb?endpoint=search/multi&query=${encodeURIComponent(q)}&language=en-US&page=1`,
      );
      const data = await res.json();
      setResults(
        (data.results ?? [])
          .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
          .slice(0, 6),
      );
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => searchTMDB(val), 400);
  };

  const handleAddMedia = async (item: any) => {
    if (selectedMedia.find((m) => m.tmdb_id === item.id)) return;
    if (selectedMedia.length >= 3) return; // max 3 for onboarding
    setAddingId(item.id);
    const type: "film" | "serie" = item.media_type === "movie" ? "film" : "serie";
    try {
      const orgId = await getCurrentOrgId();
      await supabase.schema("watching").from("media_items").insert({
        user_id: userId,
        org_id: orgId,
        type,
        title: item.title || item.name,
        original_title: item.original_title || item.original_name,
        description: item.overview || null,
        poster_url: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
        year:
          new Date(item.release_date || item.first_air_date || "").getFullYear() ||
          null,
        rating: item.vote_average || null,
        tmdb_id: item.id,
        in_progress: true,
        watched: false,
        want_to_watch: false,
        recently_watched: false,
        favorite: false,
        current_season: type === "serie" ? 1 : null,
        current_episode: type === "serie" ? 1 : null,
      });
      const updated = [
        ...selectedMedia,
        {
          tmdb_id: item.id,
          title: item.title || item.name,
          poster_url: item.poster_path
            ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
            : null,
          type,
        },
      ];
      setSelectedMedia(updated);
      onMediaChange(updated);
    } catch { /* ignore */ } finally {
      setAddingId(null);
    }
  };

  const removeMedia = (tmdb_id: number) => {
    const updated = selectedMedia.filter((m) => m.tmdb_id !== tmdb_id);
    setSelectedMedia(updated);
    onMediaChange(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-lg"
    >
      <div className="mb-5">
        <h2 className="text-2xl font-black text-white mb-1">
          What are you watching?
        </h2>
        <p className="text-zinc-500 text-sm">
          Add what you&apos;re currently in progress with.{" "}
          {selectedMedia.length < 3 && (
            <span className="text-zinc-600">Up to 3 titles.</span>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="relative flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all mb-3">
        {loading ? (
          <Loader2 size={14} className="text-zinc-500 animate-spin shrink-0" />
        ) : (
          <Search size={14} className="text-zinc-500 shrink-0" />
        )}
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Breaking Bad, Dune, The Bear..."
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-none">
        {!loading && !results.length && query.length >= 2 && (
          <p className="text-center text-zinc-600 text-sm py-4">
            No results for &quot;{query}&quot;
          </p>
        )}
        {!query && (
          <p className="text-center text-zinc-700 text-xs py-4">
            Search for a film, series, or anime
          </p>
        )}
        {results.map((item, i) => {
          const isAdded = !!selectedMedia.find((m) => m.tmdb_id === item.id);
          const isAdding = addingId === item.id;
          const isMaxed = selectedMedia.length >= 3 && !isAdded;
          const type: "film" | "serie" =
            item.media_type === "movie" ? "film" : "serie";
          const title = item.title || item.name;
          const year = new Date(
            item.release_date || item.first_air_date || "",
          ).getFullYear();

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                isAdded
                  ? "bg-violet-500/5 border border-violet-500/20"
                  : isMaxed
                    ? "opacity-40 border border-transparent"
                    : "hover:bg-zinc-900 border border-transparent hover:border-zinc-800 cursor-pointer"
              }`}
              onClick={() => !isAdded && !isAdding && !isMaxed && handleAddMedia(item)}
            >
              {/* Poster */}
              <div className="relative w-8 h-11 rounded-md overflow-hidden bg-zinc-800 shrink-0">
                {item.poster_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={14} className="text-zinc-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{title}</p>
                <p className="text-[11px] text-zinc-500">
                  {type === "film" ? "Movie" : "Series"}{year ? ` · ${year}` : ""}
                </p>
              </div>

              {/* Action */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                  isAdded
                    ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                    : isAdding
                      ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                      : "bg-zinc-900 border-zinc-700 text-zinc-500"
                }`}
              >
                {isAdding ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isAdded ? (
                  <Check size={12} />
                ) : (
                  <Plus size={12} />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected */}
      {selectedMedia.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
            In progress ({selectedMedia.length}/3)
          </p>
          <div className="flex gap-2 flex-wrap">
            {selectedMedia.map((m) => (
              <motion.div
                key={m.tmdb_id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative group"
              >
                <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-zinc-800">
                  {m.poster_url ? (
                    <Image
                      src={m.poster_url}
                      alt={m.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <Film size={16} className="text-zinc-700" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeMedia(m.tmdb_id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={9} className="text-zinc-400" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Step 3: Done ─────────────────────────────────────────────────────────────

function DoneStep({
  teams,
  players,
  media,
}: {
  teams: SelectedTeam[];
  players: SelectedPlayer[];
  media: SelectedMedia[];
}) {
  const totalConfigured = teams.length + players.length + media.length;

  const summaryParts = [
    teams.length > 0 && `${teams.length} team${teams.length > 1 ? "s" : ""}`,
    players.length > 0 && `${players.length} player${players.length > 1 ? "s" : ""}`,
    media.length > 0 && `${media.length} title${media.length > 1 ? "s" : ""}`,
  ].filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="text-center max-w-md w-full"
    >
      {/* Checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.45, duration: 0.7 }}
        className="flex justify-center mb-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl scale-150" />
          <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-4xl font-black text-white mb-3 tracking-tight"
      >
        Your HEGON is ready.
      </motion.h2>

      {totalConfigured > 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-zinc-400 text-base mb-2"
        >
          {summaryParts.join(" · ")} configured.
        </motion.p>
      ) : (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-zinc-500 text-base mb-2"
        >
          You can configure everything from your dashboard.
        </motion.p>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="text-zinc-600 text-sm"
      >
        Everything can be changed at any time.
      </motion.p>
    </motion.div>
  );
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

async function ensureWorkspace(userId: string) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("workspaces").select("id").eq("user_id", userId).limit(1);
  if (existing?.length) return;

  const orgId = await getCurrentOrgId();
  if (!orgId) return;

  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.user_metadata?.full_name?.split(" ")[0]
    ?? user?.user_metadata?.name?.split(" ")[0]
    ?? "My";

  const { data: workspace } = await supabase
    .from("workspaces")
    .insert({ name: `${userName}'s Workspace`, user_id: userId, org_id: orgId })
    .select("id").single();

  if (!workspace) return;

  const { data: project } = await supabase
    .from("projects")
    .insert({ name: "Personal", workspace_id: workspace.id, color: "#3b82f6", org_id: orgId })
    .select("id").single();

  if (!project) return;

  await supabase.from("statuses").insert([
    { name: "Backlog",      color: "#6b7280", position: 0, project_id: project.id, org_id: orgId },
    { name: "To Do",        color: "#6b7280", position: 1, project_id: project.id, org_id: orgId },
    { name: "In Progress",  color: "#f59e0b", position: 2, project_id: project.id, org_id: orgId },
    { name: "Done",         color: "#3b82f6", position: 3, project_id: project.id, org_id: orgId },
  ]);
}

export default function OnboardingFlow({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedTeams, setSelectedTeams] = useState<SelectedTeam[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);

  const next = () => setStep((s) => Math.min(s + 1, 3));

  const STEPS = ["Welcome", "Sports", "Watching", "Done"];

  return (
    <div className="h-screen flex flex-col bg-[#09090b] overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-14 flex items-center justify-between px-6 border-b border-zinc-800/40">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo/Hegon_white_logo.png"
            alt="HEGON"
            width={28}
            height={28}
          />
          <span className="font-black text-white text-sm tracking-tight">
            HEGON
          </span>
        </div>

        <ProgressDots step={step} />

        <div className="w-24 text-right">
          {step > 0 && step < 3 && (
            <span className="text-xs text-zinc-600">
              {STEPS[step]}
            </span>
          )}
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: content + footer nav */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Step content */}
          <div className="flex-1 flex items-center justify-center px-6 py-8">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <WelcomeStep key="welcome" userName={userName} />
              )}
              {step === 1 && (
                <SportsStep
                  key="sports"
                  userId={userId}
                  onTeamsChange={setSelectedTeams}
                  onPlayersChange={setSelectedPlayers}
                />
              )}
              {step === 2 && (
                <WatchingStep
                  key="watching"
                  userId={userId}
                  onMediaChange={setSelectedMedia}
                />
              )}
              {step === 3 && (
                <DoneStep
                  key="done"
                  teams={selectedTeams}
                  players={selectedPlayers}
                  media={selectedMedia}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="shrink-0 h-16 flex items-center justify-between px-8 border-t border-zinc-800/40">
            {/* Skip */}
            <div>
              {step > 0 && step < 3 && (
                <button
                  onClick={next}
                  className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Skip this step
                </button>
              )}
            </div>

            {/* Next / Enter */}
            <div>
              {step === 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={next}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-sm shadow-lg shadow-white/10 hover:bg-zinc-100 transition-colors"
                >
                  Get started
                  <ArrowRight size={15} />
                </motion.button>
              )}
              {step > 0 && step < 3 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={next}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-semibold text-sm hover:bg-zinc-700 transition-colors"
                >
                  Continue
                  <ChevronRight size={15} />
                </motion.button>
              )}
              {step === 3 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    await ensureWorkspace(userId);
                    router.push("/dashboard");
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Enter HEGON
                  <ArrowRight size={15} />
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Right: live preview — desktop only, steps 1-3 */}
        <AnimatePresence>
          {step > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="hidden lg:flex w-72 xl:w-80 shrink-0 border-l border-zinc-800/40 flex-col p-6 overflow-y-auto"
            >
              <PreviewPanel
                teams={selectedTeams}
                players={selectedPlayers}
                media={selectedMedia}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
