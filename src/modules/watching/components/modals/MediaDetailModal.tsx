/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import Image from "next/image";
import { Star, Heart, X, Info } from "lucide-react";
import type { WatchingMedia } from "@/modules/watching/types";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/utils/toast";
import { useUpdateMedia } from "@/modules/watching/hooks/useUpdateMedia";
import DeleteConfirmModal from "@/modules/watching/components/modals/DeleteConfirmModal";

// ─── types ────────────────────────────────────────────────────────────────────

type MediaDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: WatchingMedia;
  onUpdate?: (item: WatchingMedia) => void;
  onDelete?: (itemId: string) => void;
};

// ─── main ─────────────────────────────────────────────────────────────────────

export default function MediaDetailModal({
  isOpen,
  onClose,
  item,
  onUpdate,
  onDelete,
}: MediaDetailModalProps) {
  const [notes, setNotes] = useState(item.notes || "");
  const [userRating, setUserRating] = useState<number>(item.user_rating || 0);
  const [priorityLevel, setPriorityLevel] = useState<string>(
    item.priority_level ?? "medium",
  );
  const [favorite, setFavorite] = useState(item.favorite);
  const [seasonInput, setSeasonInput] = useState<string>(String(item.current_season || 1));
  const [episodeInput, setEpisodeInput] = useState<string>(String(item.current_episode || 1));
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [similarTitles, setSimilarTitles] = useState<any[]>([]);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateMediaMutation = useUpdateMedia();
  const lastFetchedId = useRef<number | null>(null);

  useEffect(() => {
    if (item) setFavorite(item.favorite);
  }, [item]);

  useEffect(() => {
    if (isOpen) {
      setNotes(item.notes || "");
      setFavorite(item.favorite);
      setUserRating(item.user_rating || 0);
      setPriorityLevel(item.priority_level ?? "medium");
      setSeasonInput(String(item.current_season || 1));
      setEpisodeInput(String(item.current_episode || 1));
      setSeasonError(null);
      setEpisodeError(null);
    }
  }, [isOpen, item]);

  // fetch similar titles
  useEffect(() => {
    if (!item?.tmdb_id || !isOpen) return;
    if (lastFetchedId.current === item.tmdb_id) return;

    const fetchSimilar = async () => {
      try {
        const type = item.type === "film" ? "movie" : "tv";
        const endpoint = `${type}/${item.tmdb_id}/recommendations`;
        const res = await fetch(
          `/api/tmdb?endpoint=${encodeURIComponent(endpoint)}&language=fr-FR`,
        );
        const data = await res.json();

        let results = data.results || [];
        if (item.type === "anime") {
          results = results.filter((r: any) => r.genre_ids?.includes(16));
        }
        setSimilarTitles(results.slice(0, 6));
        lastFetchedId.current = item.tmdb_id;
      } catch (err) {
        console.error("Erreur recommandations TMDB:", err);
      }
    };

    fetchSimilar();
  }, [item, isOpen]);

  // ─── Season / episode validation ──────────────────────────────────────────

  const maxSeason = item.seasons ?? null;

  const getMaxEpisode = (season: number): number | null =>
    item.season_episodes?.[season - 1] ?? null;

  const handleSeasonChange = (val: string) => {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setSeasonInput(val);
    setSeasonError(null);
    if (val === "") return;
    const num = parseInt(val);
    if (num < 1) {
      setSeasonError("Min: 1");
    } else if (maxSeason && num > maxSeason) {
      setSeasonError(`Max: ${maxSeason} season${maxSeason > 1 ? "s" : ""}`);
    } else {
      // Re-validate episode against the new season
      const ep = parseInt(episodeInput);
      const maxEp = getMaxEpisode(num);
      if (!isNaN(ep) && maxEp && ep > maxEp) {
        setEpisodeError(`Max: ${maxEp} ep in S${num}`);
      } else {
        setEpisodeError(null);
      }
    }
  };

  const handleSeasonBlur = () => {
    const num = parseInt(seasonInput);
    if (seasonInput === "" || isNaN(num) || num < 1) {
      setSeasonInput(String(item.current_season || 1));
      setSeasonError(null);
    }
  };

  const handleEpisodeChange = (val: string) => {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setEpisodeInput(val);
    setEpisodeError(null);
    if (val === "") return;
    const num = parseInt(val);
    const season = parseInt(seasonInput) || 1;
    const maxEp = getMaxEpisode(season);
    if (num < 1) {
      setEpisodeError("Min: 1");
    } else if (maxEp && num > maxEp) {
      setEpisodeError(`Max: ${maxEp} ep in S${season}`);
    }
  };

  const handleEpisodeBlur = () => {
    const num = parseInt(episodeInput);
    if (episodeInput === "" || isNaN(num) || num < 1) {
      setEpisodeInput(String(item.current_episode || 1));
      setEpisodeError(null);
    }
  };

  const hasProgressError = !!(seasonError || episodeError);

  // ─── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (item.in_progress && hasProgressError) return;
    try {
      const updateData: any = {
        id: item.id,
        notes,
        favorite,
        user_rating: userRating > 0 ? userRating : null,
      };

      if (item.want_to_watch) {
        updateData.priority_level = priorityLevel;
      }

      if (item.in_progress) {
        const season = parseInt(seasonInput);
        const episode = parseInt(episodeInput);
        if (isNaN(season) || isNaN(episode)) return;
        updateData.current_season = season;
        updateData.current_episode = episode;
      }

      const updated = await updateMediaMutation.mutateAsync(updateData);
      toast("Changes saved.");
      onUpdate?.(updated);
      onClose();
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
      toast.error("Failed to save changes.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error("Erreur suppression:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const ratingPercent = (userRating / 10) * 100;

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#121212] border border-white/5 shadow-2xl custom-scrollbar">
                {/* ── hero ── */}
                <div className="relative w-full aspect-21/9 md:aspect-3/1 overflow-hidden">
                  <Image
                    src={item.backdrop_url || "/placeholder.svg"}
                    alt=""
                    fill
                    className="object-cover object-top opacity-60"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#121212] via-[#121212]/40 to-transparent" />

                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/30 text-white/60 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>

                  <div className="absolute inset-0 flex items-center px-3 md:px-8 gap-6">
                    <div className="relative w-24 md:w-32 aspect-2/3 rounded-lg overflow-hidden shadow-2xl border border-white/10 shrink-0">
                      <Image
                        src={item.poster_url || "/placeholder.svg"}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                    </div>
                    <h2 className="text-3xl md:text-4xl w-[50%] font-bold text-white tracking-tight uppercase">
                      {item.title}
                    </h2>
                  </div>
                </div>

                {/* ── metadata ── */}
                <div className="px-3 md:px-8 py-4 flex flex-wrap items-center gap-6 text-zinc-400 text-sm font-medium border-b border-white/5">
                  {item.user_rating != null && item.user_rating > 0 && (
                    <div className="flex items-center gap-1.5 text-white">
                      <Star size={18} className="text-amber-400 fill-amber-400" />
                      <span className="text-lg font-bold">
                        {item.user_rating}
                      </span>
                    </div>
                  )}
                  <span>{item.year}</span>
                  <span>{item.type}</span>
                  <div className="ml-auto w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-500">
                    <Info size={14} />
                  </div>
                </div>

                {/* ── actions ── */}
                <div className="px-3 md:px-8 py-6 flex flex-wrap gap-3">
                  <Button
                    variant={item.watched ? "default" : "outline"}
                    disabled={item.watched}
                    className={cn(
                      item.watched
                        ? "bg-green-600 hover:bg-green-600 text-white cursor-default"
                        : "border-zinc-700 text-white hover:bg-white/5",
                    )}
                  >
                    {item.watched ? "Watched" : "Mark as Watched"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setFavorite(!favorite)}
                    className={cn(
                      "border-zinc-700 gap-2",
                      favorite
                        ? "text-red-400 border-red-500/40 hover:bg-red-500/5"
                        : "text-white hover:bg-white/5",
                    )}
                  >
                    <Heart size={16} className={cn(favorite && "fill-current")} />
                    {favorite ? "Favorited" : "Add to Favorites"}
                  </Button>
                </div>

                {/* ── content grid ── */}
                <div className="px-3 md:px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/5">
                  {/* left col */}
                  <div className="md:col-span-2 space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-white font-bold text-lg">Overview</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                        {item.description || "No description available."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4">
                      {item.directors && item.directors.length > 0 && (
                        <div>
                          <span className="text-zinc-500 text-sm">
                            Director(s):
                          </span>
                          <div className="flex flex-wrap gap-4 mt-2">
                            {item.directors.map((d) => (
                              <div
                                key={d.name}
                                className="flex items-center gap-2"
                              >
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                                  <Image
                                    src={d.profile_url || "/placeholder.svg"}
                                    alt={d.name}
                                    width={32}
                                    height={32}
                                  />
                                </div>
                                <span className="text-xs text-zinc-400">
                                  {d.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.studio && (
                        <div className="text-sm">
                          <span className="text-zinc-500">Studio:</span>{" "}
                          <span className="text-zinc-300">{item.studio}</span>
                        </div>
                      )}
                    </div>

                    {/* notes */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Personal Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Your thoughts..."
                        className="mt-2 w-full p-4 bg-zinc-800/50 border border-white/5 rounded-2xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 h-24 resize-none transition-all"
                      />
                    </div>


                    {/* rating — masqué pour À voir et En cours */}
                    {(item.watched || item.priority != null) && !item.want_to_watch && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Star size={14} className="text-amber-400" />
                            My Rating
                          </span>
                          <span className="text-amber-400 font-black text-base">
                            {userRating > 0 ? userRating.toFixed(1) : "--"}
                          </span>
                        </label>

                        <div className="space-y-2">
                          <div className="relative h-2 bg-zinc-800 rounded-full">
                            <div
                              className="absolute inset-y-0 left-0 bg-amber-400 rounded-full transition-all duration-150"
                              style={{ width: `${ratingPercent}%` }}
                            />
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              value={userRating}
                              onChange={(e) =>
                                setUserRating(parseFloat(e.target.value))
                              }
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* priority — uniquement pour À voir */}
                    {item.want_to_watch && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Priority Level
                        </label>
                        <div className="flex gap-2">
                          {(["high", "medium", "low"] as const).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => setPriorityLevel(level)}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                                priorityLevel === level
                                  ? level === "high"
                                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                                    : level === "medium"
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                      : "bg-zinc-500/20 border-zinc-500/50 text-zinc-400"
                                  : "bg-zinc-800/50 border-white/5 text-zinc-600 hover:text-zinc-400",
                              )}
                            >
                              {level === "high"
                                ? "High"
                                : level === "medium"
                                  ? "Medium"
                                  : "Low"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* right col */}
                  <div className="space-y-6">
                    <h3 className="text-white font-bold text-lg">
                      Technical Details
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-zinc-500">Release date:</span>
                        <span className="text-zinc-300">{item.year}</span>
                      </div>
                      {item.runtime && (
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-500">Runtime:</span>
                          <span className="text-zinc-300">
                            {item.type === "serie" && item.episodes
                              ? `~${item.runtime} min/episode`
                              : `${item.runtime} min`}
                          </span>
                        </div>
                      )}
                      {item.status && (
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-500">Status:</span>
                          <span className="text-zinc-300">{item.status}</span>
                        </div>
                      )}
                      {item.seasons && (
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-500">Seasons:</span>
                          <span className="text-zinc-300">{item.seasons}</span>
                        </div>
                      )}
                      {item.episodes && (
                        <div className="flex flex-col gap-1">
                          <span className="text-zinc-500">Episodes:</span>
                          <span className="text-zinc-300">{item.episodes}</span>
                        </div>
                      )}
                      {item.in_progress && (item.type === "serie" || item.type === "anime") && (
                        <div className="flex flex-col gap-2">
                          <span className="text-zinc-500">Progression:</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-xs text-zinc-600">
                                Season{maxSeason ? ` (max ${maxSeason})` : ""}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={seasonInput}
                                onChange={(e) => handleSeasonChange(e.target.value)}
                                onBlur={handleSeasonBlur}
                                className={cn(
                                  "w-full bg-zinc-800/50 border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1",
                                  seasonError
                                    ? "border-red-500/60 focus:ring-red-500/50"
                                    : "border-white/5 focus:ring-blue-500/50",
                                )}
                              />
                              {seasonError && (
                                <p className="text-[11px] text-red-400 leading-tight">{seasonError}</p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs text-zinc-600">
                                Episode{getMaxEpisode(parseInt(seasonInput) || 1) ? ` (max ${getMaxEpisode(parseInt(seasonInput) || 1)})` : ""}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={episodeInput}
                                onChange={(e) => handleEpisodeChange(e.target.value)}
                                onBlur={handleEpisodeBlur}
                                className={cn(
                                  "w-full bg-zinc-800/50 border rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1",
                                  episodeError
                                    ? "border-red-500/60 focus:ring-red-500/50"
                                    : "border-white/5 focus:ring-blue-500/50",
                                )}
                              />
                              {episodeError && (
                                <p className="text-[11px] text-red-400 leading-tight">{episodeError}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── similar titles ── */}
                {similarTitles.length > 0 && (
                  <div className="px-3 md:px-8 py-8 border-t border-white/5 space-y-6">
                    <h3 className="text-white font-bold text-lg">
                      Similar Titles
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-6">
                      {similarTitles.map((sim) => (
                        <div
                          key={sim.id}
                          className="group cursor-pointer space-y-3"
                        >
                          <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                            <Image
                              src={
                                sim.poster_path
                                  ? `https://image.tmdb.org/t/p/w500${sim.poster_path}`
                                  : "/placeholder.svg"
                              }
                              alt={sim.title || sim.name}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                          <p className="text-sm font-medium text-zinc-300 line-clamp-2 group-hover:text-white transition-colors">
                            {sim.title || sim.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── footer ── */}
                <div className="px-3 md:px-8 py-6 bg-black/20 border-t border-white/5 flex items-center justify-between">
                  {onDelete && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={updateMediaMutation.isPending || (item.in_progress && hasProgressError)}
                    className="ml-auto bg-zinc-100 text-black hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {updateMediaMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title={`Delete "${item.title}" ?`}
        description="This media will be permanently deleted from your collection."
        isDeleting={isDeleting}
      />
    </>
  );
}