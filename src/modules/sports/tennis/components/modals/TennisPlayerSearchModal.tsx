"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Check, Loader2, Trophy } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportsDBPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string | null;
  strThumb: string | null;
  strCutout: string | null;
  strSport: string | null;
  dateBorn: string | null
}

interface TennisPlayerSearchModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentFavoriteIds: string[];
  onPlayerAdded: (player?: {
    id: string;
    name: string;
    country: string | null;
    photo_url: string | null;
    birth_date: string | null
  }) => void;
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function TennisPlayerSearchModal({
  open,
  onClose,
  currentFavoriteIds,
  onPlayerAdded,
}: TennisPlayerSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SportsDBPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [existingApiIds, setExistingApiIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setAddedIds(new Set());
      setError(null);
      // Charger les API IDs déjà en favoris
      loadExistingApiIds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Charger les idPlayer déjà favoris ────────────────────────────────────
  const loadExistingApiIds = async () => {
    if (!currentFavoriteIds.length) {
      setExistingApiIds(new Set());
      return;
    }

    try {
      const res = await fetch("/api/tennis/get-api-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: currentFavoriteIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setExistingApiIds(new Set(data.apiIds ?? []));
      }
    } catch (err) {
      console.error("Failed to load existing API IDs:", err);
    }
  };

  const searchPlayers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      const players: SportsDBPlayer[] = (data?.player ?? [])
        .filter((p: SportsDBPlayer) => p.strSport === "Tennis")
        .slice(0, 8);
      setResults(players);
    } catch {
      setError("Search error. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlayers(val), 400);
  };

  // ─── Add player ───────────────────────────────────────────────────────────

  const handleAddPlayer = async (player: SportsDBPlayer) => {
    // Vérifier doublon
    if (existingApiIds.has(player.idPlayer) || addedIds.has(player.idPlayer)) {
      return;
    }

    setAddingId(player.idPlayer);
    setError(null);

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

      if (!res.ok) throw new Error(data.error ?? "An error occurred");

      setAddedIds((prev) => new Set([...prev, player.idPlayer]));
      setExistingApiIds((prev) => new Set([...prev, player.idPlayer]));

      // ✅ on passe le joueur avec son UUID Supabase retourné par l'API
      onPlayerAdded({
        id: data.playerUUID,
        name: player.strPlayer,
        country: player.strNationality ?? null,
        photo_url: player.strThumb ?? player.strCutout ?? null,
        birth_date : player.dateBorn,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
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
            <div className="rounded-xl border border-border-strong bg-surface-3 shadow-2xl shadow-black/60 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Trophy size={15} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text-primary">
                      Add a Player
                    </h2>
                    <p className="text-[11px] text-text-tertiary">
                      Search for an ATP player
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-border-default transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="relative flex items-center gap-2 rounded-xl bg-surface-2 border border-border-subtle px-3 py-2.5 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
                  {loading ? (
                    <Loader2
                      size={15}
                      className="text-text-tertiary animate-spin shrink-0"
                    />
                  ) : (
                    <Search size={15} className="text-text-tertiary shrink-0" />
                  )}
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Djokovic, Alcaraz, Sinner..."
                    className="flex-1 bg-transparent text-sm text-text-primary placeholder-zinc-600 outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                      }}
                      className="text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="max-h-90 overflow-y-auto scrollbar-none">
                <AnimatePresence mode="wait">
                  {!loading && !results.length && !query && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-3 py-10 text-center"
                    >
                      <div className="text-3xl">🎾</div>
                      <p className="text-text-tertiary text-sm">
                        Type an ATP player name
                      </p>
                    </motion.div>
                  )}
                  {!loading && !results.length && query.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-3 py-10 text-center"
                    >
                      <div className="text-3xl">🔍</div>
                      <p className="text-text-tertiary text-sm">
                        No player found for {query}
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
                      {results.map((player, i) => {
                        const isAlreadyFav = existingApiIds.has(player.idPlayer);
                        const isAdded = addedIds.has(player.idPlayer) || isAlreadyFav;
                        const isAdding = addingId === player.idPlayer;
                        const photoUrl = player.strThumb ?? player.strCutout;
                        return (
                          <motion.li
                            key={player.idPlayer}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <div
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isAdded
                                  ? "bg-amber-500/5 border border-amber-500/20"
                                  : "hover:bg-surface-2 border border-transparent hover:border-border-subtle"
                              }`}
                            >
                              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/50">
                                {photoUrl ? (
                                  <Image
                                    src={photoUrl}
                                    alt={player.strPlayer}
                                    fill
                                    className="object-cover"
                                    sizes="40px"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-end bg-linear-to-b from-zinc-700 to-zinc-800 overflow-hidden">
                                    <div className="w-4 h-4 rounded-full bg-zinc-500 mb-0.5 shrink-0" />
                                    <div className="w-7 h-4 rounded-t-full bg-zinc-500 shrink-0" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text-primary truncate">
                                  {player.strPlayer}
                                </p>
                                <p className="text-[11px] text-text-tertiary flex items-center gap-1">
                                  <span>{getFlagEmoji(player.strNationality)}</span>
                                  <span>
                                    {player.strNationality ?? "Unknown nationality"}
                                  </span>
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  !isAdded && !isAdding && handleAddPlayer(player)
                                }
                                disabled={isAdded || isAdding}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 border
                                  ${
                                    isAdded
                                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-default"
                                      : isAdding
                                        ? "bg-zinc-800 border-zinc-700 text-text-tertiary cursor-wait"
                                        : "bg-zinc-900 border-zinc-700 text-text-secondary hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-400"
                                  }`}
                              >
                                {isAdding ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : isAdded ? (
                                  <Check size={13} />
                                ) : (
                                  <Plus size={13} />
                                )}
                              </button>
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
              <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">Data via TheSportsDB</p>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:border-border-default transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}