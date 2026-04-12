/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Check, Loader2, Shield } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FootballTeam {
  id: string;
  name: string;
  crest_url: string | null;
  api_external_id: string;
}

interface FootballTeamSearchModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentFavoriteIds: string[];
  onTeamAdded: (team: FootballTeam) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FootballTeamSearchModal({
  open,
  onClose,
  userId,
  currentFavoriteIds,
  onTeamAdded,
}: FootballTeamSearchModalProps) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FootballTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setAddedIds(new Set());
      setError(null);
    }
  }, [open]);

  const searchTeams = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .schema("sport")
          .from("football_teams")
          .select("id, name, crest_url, api_external_id")
          .ilike("name", `%${q}%`)
          .limit(8);
        if (err) throw err;
        setResults(data ?? []);
      } catch {
        setError("Search error.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTeams(val), 350);
  };

  const handleAddTeam = async (team: FootballTeam) => {
    if (currentFavoriteIds.includes(team.id) || addedIds.has(team.id)) return;
    setAddingId(team.id);
    setError(null);
    try {
      const orgId = await getCurrentOrgId();
      const { error: err } = await supabase
        .schema("sport")
        .from("user_favorites")
        .insert({
          user_id: userId,
          entity_type: "football_team",
          entity_id: team.id,
          org_id: orgId,
        });
      if (err) throw err;
      setAddedIds((prev) => new Set([...prev, team.id]));
      onTeamAdded(team);
    } catch (err: any) {
      setError(err.message ?? "An error occurred");
    } finally {
      setAddingId(null);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg"
          >
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-zinc-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Shield size={15} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Add a Team
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Search for a favorite team
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700"
                >
                  <X size={14} />
                </Button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <div className="relative flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
                  {loading ? (
                    <Loader2
                      size={15}
                      className="text-zinc-500 animate-spin shrink-0"
                    />
                  ) : (
                    <Search size={15} className="text-zinc-500 shrink-0" />
                  )}
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Barcelona, Real Madrid, PSG..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                      }}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto scrollbar-none">
                <AnimatePresence mode="wait">
                  {!loading && !results.length && !query && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-3 py-10 text-center"
                    >
                      <Shield size={28} className="text-zinc-700" />
                      <p className="text-zinc-600 text-sm">
                        Type a team name
                      </p>
                    </motion.div>
                  )}
                  {!loading && !results.length && query.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-3 py-10 text-center"
                    >
                      <p className="text-zinc-500 text-sm">
                        No team found for {query}
                      </p>
                    </motion.div>
                  )}
                  {results.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-2 space-y-1"
                    >
                      {results.map((team, i) => {
                        const isAlreadyFav = currentFavoriteIds.includes(
                          team.id,
                        );
                        const isAdded = addedIds.has(team.id) || isAlreadyFav;
                        const isAdding = addingId === team.id;
                        return (
                          <motion.li
                            key={team.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <div
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isAdded
                                  ? "bg-emerald-500/5 border border-emerald-500/20"
                                  : "hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
                              }`}
                            >
                              <div className="w-10 h-10 shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                                <Shield
                                  size={18}
                                  className="text-emerald-400"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                  {team.name}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant={isAdded ? "ghost" : "outline"}
                                disabled={isAdded || isAdding}
                                onClick={() =>
                                  !isAdded && !isAdding && handleAddTeam(team)
                                }
                                className={`w-8 h-8 shrink-0 ${
                                  isAdded
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                                    : isAdding
                                      ? "cursor-wait"
                                      : "hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400"
                                }`}
                              >
                                {isAdding ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : isAdded ? (
                                  <Check size={13} />
                                ) : (
                                  <Plus size={13} />
                                )}
                              </Button>
                            </div>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
                {error && (
                  <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
                >
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
