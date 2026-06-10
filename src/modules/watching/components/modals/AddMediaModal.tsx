/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import { useDebounce } from "@/shared/hooks/useDebounce";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Search, X, Upload, Star, Heart, Bookmark,
  Film, Calendar, Loader2, Plus, Trophy,
  History, Eye, Tag, Play, AlertCircle, Check,
} from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { useAddMedia } from "@/modules/watching/hooks/useAddMedia";
import { RatingSlider } from "@/modules/watching/components/detail/MyTakeRecord";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { getTakenPriorities, getExistingMediaEntry, uploadCustomPoster } from "@/modules/watching/service";
import { resolveTransition } from "@/modules/watching/lib/resolve-transition";
import type { ListType, MediaType, TmdbModalResult } from "@/modules/watching/types";

type AddMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (item?: any) => void;
  defaultType?: MediaType;
  listContext?: ListType;
  initialItem?: any;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PRIORITY_CONFIG = {
  high:   { dot: "bg-red-400",   text: "text-red-400",   activeBg: "bg-red-400/10 border-red-400/30"   },
  medium: { dot: "bg-amber-400", text: "text-amber-400", activeBg: "bg-amber-400/10 border-amber-400/30" },
  low:    { dot: "bg-zinc-500",  text: "text-zinc-400",  activeBg: "bg-zinc-500/10 border-zinc-500/30"  },
} as const;

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption uppercase text-text-tertiary mb-2">
      {children}
    </p>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AddMediaModal({
  isOpen,
  onClose,
  onAdded,
  defaultType = "film",
  listContext = "recentlyWatched",
  initialItem,
}: AddMediaModalProps) {
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<TmdbModalResult[]>([]);
  const [selectedItem, setSelectedItem]   = useState<TmdbModalResult | null>(null);
  const [customPoster, setCustomPoster]   = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [conflict, setConflict]           = useState<{
    existingLists: string[];
    canAdd: boolean;
    message: string;
  } | null>(null);

  const [userRating, setUserRating]   = useState<number>(0);
  const [notes, setNotes]             = useState("");
  const [favorite, setFavorite]       = useState(false);
  const [priority, setPriority]       = useState<number | null>(null);
  const [priorityLevel, setPriorityLevel] = useState<"high" | "medium" | "low">("medium");
  const [takenPriorities, setTakenPriorities] = useState<number[]>([]);

  const [watchedYear, setWatchedYear]   = useState<number>(new Date().getFullYear());
  const [watchedMonth, setWatchedMonth] = useState<number | null>(null);

  const [seasons, setSeasons]         = useState<number | null>(null);
  const [episodes, setEpisodes]       = useState<number | null>(null);
  const [seasonInput, setSeasonInput] = useState<string>("1");
  const [episodeInput, setEpisodeInput] = useState<string>("1");
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [runtime, setRuntime]         = useState<number | null>(null);
  const [directors, setDirectors]     = useState<{ name: string; profile_url: string | null }[] | null>(null);
  const [studio, setStudio]           = useState<string | null>(null);
  const [status, setStatus]           = useState<string | null>(null);

  const addMediaMutation = useAddMedia();

  // ── Fetch taken priorities ─────────────────────────────────────────────────

  const fetchTakenPriorities = useCallback(async () => {
    if (listContext !== "topTen") return;
    setTakenPriorities(await getTakenPriorities(defaultType));
  }, [listContext, defaultType]);

  // ── Reset on close ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setSearchQuery(""); setSearchResults([]); setSelectedItem(null);
        setCustomPoster(null); setPreviewUrl(null);
        setUserRating(0); setNotes(""); setFavorite(false);
        setPriority(null); setSeasonInput("1"); setEpisodeInput("1");
        setSeasonError(null); setEpisodeError(null); setConflict(null);
        setPriorityLevel("medium");
        setWatchedYear(new Date().getFullYear()); setWatchedMonth(null);
      }, 300);
      return () => clearTimeout(t);
    } else {
      fetchTakenPriorities();
    }
  }, [isOpen, fetchTakenPriorities]);

  // ── TMDB search ───────────────────────────────────────────────────────────

  const searchTMDB = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const endpoint = defaultType === "film" ? "search/movie" : "search/tv";
      const res  = await fetch(`/api/tmdb?endpoint=${endpoint}&query=${encodeURIComponent(query)}&language=en-US&page=1`);
      const data = await res.json();
      let results: TmdbModalResult[] = data.results || [];
      if (defaultType === "anime") {
        results = results.filter((r) => r.genre_ids?.includes(16) || r.origin_country?.includes("JP"));
      }
      setSearchResults(results.slice(0, 6));
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }, [defaultType]);

  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  useEffect(() => { searchTMDB(debouncedSearchQuery); }, [debouncedSearchQuery, searchTMDB]);

  // ── Select result ─────────────────────────────────────────────────────────

  const selectResult = async (result: TmdbModalResult) => {
    setSelectedItem(result);
    setSearchQuery("");
    setSearchResults([]);

    // Reset all form fields so a second pick never inherits the first pick's data
    setUserRating(0);
    setNotes("");
    setFavorite(false);
    setConflict(null);
    setCustomPoster(null);
    setPreviewUrl(null);
    setRuntime(null);
    setDirectors(null);
    setStudio(null);
    setStatus(null);
    setSeasons(null);
    setEpisodes(null);
    setSeasonInput("1");
    setEpisodeInput("1");
    setSeasonError(null);
    setEpisodeError(null);

    try {
      const mediaType  = result.media_type || (result.first_air_date ? "tv" : "movie");
      const isMovie    = mediaType === "movie";
      const res        = await fetch(`/api/tmdb?endpoint=${isMovie ? `movie/${result.id}` : `tv/${result.id}`}&append_to_response=credits&language=en-US`);
      const details: TmdbModalResult = await res.json();

      let runtimeMinutes: number | null = null;
      if (isMovie) {
        runtimeMinutes = details.runtime ?? null;
      } else if (Array.isArray(details.episode_run_time) && details.episode_run_time.length > 0) {
        const sum = details.episode_run_time.reduce((a, b) => a + b, 0);
        runtimeMinutes = Math.round(sum / details.episode_run_time.length);
      } else if (details.last_episode_to_air?.runtime) {
        runtimeMinutes = details.last_episode_to_air.runtime;
      }

      const extractedDirectors = isMovie
        ? (details.credits?.crew ?? [])
            .filter((m) => m.job === "Director")
            .map((d) => ({ name: d.name, profile_url: d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : null }))
        : (details.created_by ?? []).map((c) => ({
            name: c.name,
            profile_url: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
          }));

      const extractedStudio  = isMovie ? (details.production_companies?.[0]?.name ?? null) : (details.networks?.[0]?.name ?? null);
      const rawStatus        = details.status?.toLowerCase() ?? null;
      const extractedStatus  = isMovie ? rawStatus : (rawStatus === "ended" ? "ended" : "ongoing");

      setRuntime(runtimeMinutes);
      setDirectors(extractedDirectors);
      setStudio(extractedStudio);
      setStatus(extractedStatus);
      if (!isMovie) { setSeasons(details.number_of_seasons ?? null); setEpisodes(details.number_of_episodes ?? null); }

      const merged: TmdbModalResult = {
        ...result,
        ...details,
        poster_path:   result.poster_path   ?? details.poster_path,
        backdrop_path: result.backdrop_path ?? details.backdrop_path,
      };
      setSelectedItem(merged);

      // Check for existing entry
      const existing = await getExistingMediaEntry(defaultType, result.id);

      if (!existing) { setConflict(null); return; }

      setUserRating(existing.user_rating ?? 0);
      setNotes(existing.notes ?? "");
      setFavorite(existing.favorite ?? false);
      if (listContext === "inProgress") {
        setSeasonInput(String(existing.current_season ?? 1));
        setEpisodeInput(String(existing.current_episode ?? 1));
      }

      const transition = resolveTransition(existing, listContext);
      setConflict(
        transition.message
          ? { existingLists: transition.existingLists, canAdd: transition.allowed, message: transition.message }
          : null,
      );
    } catch {
      toast.error("Failed to fetch media details.");
    }
  };

  // Auto-select initialItem when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen && initialItem) selectResult(initialItem); }, [isOpen]);

  // ── Season / episode validation ───────────────────────────────────────────

  const maxSeason = seasons;

  const getMaxEpisode = (season: number): number | null => {
    if (!selectedItem?.seasons || !Array.isArray(selectedItem.seasons)) return null;
    const s = selectedItem.seasons.find((s) => s.season_number === season);
    return s?.episode_count ?? null;
  };

  const handleSeasonChange = (val: string) => {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setSeasonInput(val); setSeasonError(null);
    if (val === "") return;
    const num = parseInt(val);
    if (num < 1) { setSeasonError("Min: 1"); return; }
    if (maxSeason && num > maxSeason) { setSeasonError(`Max: ${maxSeason} season${maxSeason > 1 ? "s" : ""}`); return; }
    const ep = parseInt(episodeInput);
    const maxEp = getMaxEpisode(num);
    if (!isNaN(ep) && maxEp && ep > maxEp) setEpisodeError(`Max: ${maxEp} ep in S${num}`);
    else setEpisodeError(null);
  };

  const handleEpisodeChange = (val: string) => {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setEpisodeInput(val); setEpisodeError(null);
    if (val === "") return;
    const num = parseInt(val);
    const season = parseInt(seasonInput) || 1;
    const maxEp  = getMaxEpisode(season);
    if (num < 1) setEpisodeError("Min: 1");
    else if (maxEp && num > maxEp) setEpisodeError(`Max: ${maxEp} ep in S${season}`);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedItem) return;
    if (listContext === "topTen" && priority === null) return;
    if (listContext === "inProgress" && (seasonError || episodeError)) return;

    setSubmitLoading(true);
    try {
      let finalPosterUrl = previewUrl;
      if (customPoster) {
        const url = await uploadCustomPoster(customPoster);
        if (url) finalPosterUrl = url;
      }

      // No month picked → "watched now" for the current year (so it lands first in
      // Recently Watched), else end-of-year for a back-dated year.
      const now = new Date();
      const watchedAt = listContext === "library"
        ? (watchedMonth !== null
            ? new Date(watchedYear, watchedMonth - 1, 1).toISOString()
            : watchedYear === now.getFullYear()
              ? now.toISOString()
              : new Date(watchedYear, 11, 31).toISOString())
        : null;

      const result = await addMediaMutation.mutateAsync({
        selectedItem, defaultType, listContext,
        userRating, notes, favorite, priority, priorityLevel,
        currentSeason: parseInt(seasonInput) || 1,
        currentEpisode: parseInt(episodeInput) || 1,
        seasons, episodes, runtime, directors, studio, status,
        customPosterUrl: finalPosterUrl,
        genres: mapTmdbGenres(selectedItem.genre_ids),
        watchedAt,
      });

      toast.success("Added to your collection.");
      onAdded(result);
      onClose();
    } catch {
      toast.error("Failed to add media.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Header info ───────────────────────────────────────────────────────────

  const header = useMemo(() => {
    const typeLabel = defaultType === "film" ? "a Movie" : defaultType === "serie" ? "a Series" : "an Anime";
    switch (listContext) {
      case "topTen":          return { title: `Add ${typeLabel} to Top 10`,            icon: <Trophy   size={16} className="text-amber-400" /> };
      case "inProgress":      return { title: `Add ${typeLabel} to In Progress`,        icon: <Play     size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      case "recentlyWatched": return { title: `Add ${typeLabel} to Recently Watched`,   icon: <History  size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      case "wantToWatch":     return { title: `Add ${typeLabel} to Want to Watch`,      icon: <Bookmark size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      case "library":         return { title: `Add to Library`,                          icon: <Film     size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      default:                return { title: "Add Media",                               icon: <Plus     size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
    }
  }, [defaultType, listContext]);

  // ── Watched date helpers (library only) ──────────────────────────────────

  const nowYear  = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  const releaseStr  = selectedItem?.release_date || selectedItem?.first_air_date || "";
  const releaseYear  = releaseStr ? parseInt(releaseStr.slice(0, 4)) : 1900;
  const releaseMonth = releaseStr ? parseInt(releaseStr.slice(5, 7)) || 1 : 1;

  const availableYears = Array.from(
    { length: nowYear - releaseYear + 1 },
    (_, i) => nowYear - i,
  );
  const minMonth = watchedYear === releaseYear ? releaseMonth : 1;
  const maxMonth = watchedYear === nowYear ? nowMonth : 12;
  const availableMonths = Array.from({ length: maxMonth - minMonth + 1 }, (_, i) => minMonth + i);

  const handleYearChange = (year: number) => {
    setWatchedYear(year);
    if (watchedMonth !== null) {
      const newMin = year === releaseYear ? releaseMonth : 1;
      const newMax = year === nowYear ? nowMonth : 12;
      if (watchedMonth < newMin || watchedMonth > newMax) setWatchedMonth(null);
    }
  };

  // ── Disable logic (aligned between footer and handleSubmit) ───────────────

  const isSubmitDisabled =
    submitLoading ||
    !selectedItem ||
    conflict?.canAdd === false ||
    (listContext === "topTen" && priority === null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-lg border border-border-strong bg-surface-3 focus:outline-none"
          style={{ height: "85vh", maxHeight: "85vh" }}
        >

          {/* ── Header ── */}
          <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 border border-border-subtle">
                {header.icon}
              </div>
              <Dialog.Title className="text-sm font-semibold text-text-primary">
                {header.title}
              </Dialog.Title>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Content ── */}
          <div
            className={cn(
              "flex-1 px-6 py-5 custom-scrollbar",
              selectedItem ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            {/* Search */}
            <div className="relative mb-5">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder={`Search for ${defaultType === "film" ? "a movie" : defaultType === "serie" ? "a series" : "an anime"}…`}
                  className="w-full rounded-xl border border-border-subtle bg-surface-overlay pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchLoading && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <Loader2 size={15} className="animate-spin text-text-tertiary" />
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-20 overflow-hidden rounded-lg border border-border-strong bg-surface-3 shadow-md max-h-64 overflow-y-auto custom-scrollbar">
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => selectResult(res)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 text-left transition-colors border-b border-border-subtle last:border-0"
                    >
                      <div className="relative w-9 h-13 shrink-0 overflow-hidden rounded-md bg-surface-2">
                        {res.poster_path
                          ? <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} alt="" className="w-full h-full object-cover" />
                          : <Film size={14} className="text-text-tertiary absolute inset-0 m-auto" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary line-clamp-1">{res.title || res.name}</p>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {res.release_date?.slice(0, 4) || res.first_air_date?.slice(0, 4)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Conflict banner */}
            {conflict && (
              <div className={cn(
                "flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-5 border",
                conflict.canAdd
                  ? "bg-amber-500/8 border-amber-500/20 text-amber-400"
                  : "bg-red-500/8 border-red-500/20 text-red-400",
              )}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{conflict.message}</span>
              </div>
            )}

            {/* Selected item */}
            {selectedItem ? (
              <div className="space-y-5">

                {/* Poster + metadata */}
                <div className="relative overflow-hidden rounded-xl bg-surface-2/50 border border-border-subtle p-4 flex flex-col sm:flex-row gap-5">
                  {/* blurred bg */}
                  <div className="absolute inset-0 -z-10 opacity-50 blur-3xl scale-110 pointer-events-none">
                    <img
                      src={previewUrl || (selectedItem.poster_path ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` : "")}
                      alt="" className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Poster */}
                  <div className="relative group shrink-0 mx-auto sm:mx-0">
                    <div className="w-28 aspect-2/3 rounded-lg overflow-hidden border border-border-subtle">
                      <img
                        src={previewUrl || (selectedItem.poster_path ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` : "/placeholder.png")}
                        alt="" className="w-full h-full object-cover"
                      />
                    </div>
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                      <Upload size={18} className="text-white mb-1" />
                      <span className="text-[10px] font-medium text-white">Custom</span>
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { if (previewUrl) URL.revokeObjectURL(previewUrl); setCustomPoster(file); setPreviewUrl(URL.createObjectURL(file)); }
                      }} className="hidden" />
                    </label>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <h4 className="text-base font-bold text-text-primary leading-tight">
                      {selectedItem.title || selectedItem.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                        <Star size={11} className="fill-amber-400" />
                        {selectedItem.vote_average?.toFixed(1)}
                      </div>
                      <div className="flex items-center gap-1 text-text-tertiary text-[11px]">
                        <Calendar size={11} />
                        {selectedItem.release_date?.slice(0, 4) || selectedItem.first_air_date?.slice(0, 4)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mapTmdbGenres(selectedItem.genre_ids).map((genre) => (
                        <span key={genre} className="px-2 py-0.5 bg-surface-overlay border border-border-subtle rounded-md text-[10px] text-text-secondary flex items-center gap-1">
                          <Tag size={8} style={{ color: "var(--color-accent-watching-vivid)" }} />
                          {genre}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-text-tertiary leading-relaxed line-clamp-2 italic">
                      {selectedItem.overview}
                    </p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* Left column */}
                  <div className="space-y-5">

                    {/* Rating slider — hidden for wantToWatch and inProgress */}
                    {listContext !== "wantToWatch" && listContext !== "inProgress" && (
                      <div>
                        <SectionLabel>
                          <span className="flex items-center gap-1.5">
                            <Star size={11} style={{ color: "var(--color-accent-watching-vivid)" }} />
                            Your Rating
                          </span>
                        </SectionLabel>
                        <div className="rounded-xl bg-accent-watching p-4">
                          <RatingSlider value={userRating} onChange={setUserRating} />
                        </div>
                      </div>
                    )}

                    {/* Top 10 ranking */}
                    {listContext === "topTen" && (
                      <div>
                        <SectionLabel>
                          <span className="flex items-center gap-1.5">
                            <Trophy size={11} className="text-amber-400" />
                            Top 10 Ranking
                          </span>
                        </SectionLabel>
                        <div className="flex justify-between gap-1">
                          {[1,2,3,4,5,6,7,8,9,10].map((num) => {
                            const isTaken = takenPriorities.includes(num);
                            return (
                              <button
                                key={num}
                                type="button"
                                disabled={isTaken}
                                onClick={() => setPriority(num)}
                                className={cn(
                                  "flex-1 h-8 rounded-lg text-[10px] font-bold transition-[background-color,border-color,color] border",
                                  priority === num
                                    ? "bg-amber-500 border-amber-400 text-black"
                                    : isTaken
                                      ? "bg-surface-overlay border-border-subtle text-text-disabled cursor-not-allowed opacity-50"
                                      : "bg-surface-overlay border-border-subtle text-text-tertiary hover:border-border-default hover:text-text-secondary",
                                )}
                              >
                                {num}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <SectionLabel>Personal Notes</SectionLabel>
                      <textarea
                        placeholder="Your thoughts…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full p-3.5 bg-surface-overlay border border-border-subtle rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus h-24 resize-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    <SectionLabel>Status &amp; Options</SectionLabel>

                    {/* topTen info box */}
                    {listContext === "topTen" && (
                      <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 flex items-start gap-3">
                        <Trophy size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-200/60 leading-relaxed">
                          This media will be added to your <strong>Top 10</strong>. It is automatically marked as favorite and watched.
                        </p>
                      </div>
                    )}

                    {/* Favorite toggle — recentlyWatched + library */}
                    {(listContext === "recentlyWatched" || listContext === "library") && (
                      <button
                        type="button"
                        onClick={() => setFavorite(!favorite)}
                        className={cn(
                          "w-full flex items-center justify-between p-3.5 rounded-xl border transition-[background-color,border-color,color]",
                          favorite
                            ? "bg-red-500/8 border-red-500/25 text-red-400"
                            : "bg-surface-overlay border-border-subtle text-text-secondary hover:border-border-default",
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Heart size={16} className={favorite ? "fill-red-400" : ""} />
                          <span className="text-sm font-medium">Add to Favorites</span>
                        </div>
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          favorite ? "border-red-400 bg-red-400" : "border-border-strong",
                        )}>
                          {favorite && <Check size={9} className="text-white" />}
                        </div>
                      </button>
                    )}

                    {/* recentlyWatched info */}
                    {listContext === "recentlyWatched" && (
                      <div className="p-3 rounded-xl border border-border-subtle bg-surface-overlay flex items-center gap-2">
                        <Eye size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
                        <p className="text-[11px] text-text-tertiary">Marked as watched today.</p>
                      </div>
                    )}

                    {/* library — watched date + info */}
                    {listContext === "library" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-caption uppercase text-text-tertiary block">
                            When did you watch it?
                          </label>
                          <div className="flex gap-2">
                            <Select
                              value={watchedMonth !== null ? String(watchedMonth) : "none"}
                              onValueChange={(v) => setWatchedMonth(v === "none" ? null : parseInt(v))}
                            >
                              <SelectTrigger className="flex-1 h-9 bg-surface-overlay border-border-subtle text-text-secondary text-xs focus:ring-0 focus:ring-offset-0 transition-colors">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                                <SelectItem value="none" className="text-xs focus:bg-surface-2 focus:text-text-primary cursor-pointer">Month (optional)</SelectItem>
                                {availableMonths.map((m) => (
                                  <SelectItem key={m} value={String(m)} className="text-xs focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                                    {MONTH_NAMES[m - 1]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={String(watchedYear)}
                              onValueChange={(v) => handleYearChange(parseInt(v))}
                            >
                              <SelectTrigger className="w-24 h-9 bg-surface-overlay border-border-subtle text-text-secondary text-xs focus:ring-0 focus:ring-offset-0 transition-colors">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-surface-3 border-border-strong text-text-secondary">
                                {availableYears.map((y) => (
                                  <SelectItem key={y} value={String(y)} className="text-xs focus:bg-surface-2 focus:text-text-primary cursor-pointer">
                                    {y}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl border border-border-subtle bg-surface-overlay flex items-center gap-2">
                          <Film size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
                          <p className="text-[11px] text-text-tertiary">Archived in your library.</p>
                        </div>
                      </div>
                    )}

                    {/* inProgress season/episode */}
                    {listContext === "inProgress" && (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-overlay flex items-start gap-2.5">
                          <Play size={13} style={{ color: "var(--color-accent-watching-vivid)" }} className="shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] text-text-secondary leading-relaxed">Set where you are to track your progress.</p>
                            <p className="text-[10px] text-text-tertiary mt-0.5 leading-relaxed">Season/episode follows TMDB structure.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-caption uppercase text-text-tertiary">
                              Season{maxSeason ? ` (max ${maxSeason})` : ""}
                            </label>
                            <input
                              type="text" inputMode="numeric" value={seasonInput}
                              onChange={(e) => handleSeasonChange(e.target.value)}
                              onBlur={() => { if (!seasonInput || parseInt(seasonInput) < 1) { setSeasonInput("1"); setSeasonError(null); } }}
                              className={cn(
                                "w-full bg-surface-overlay border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors",
                                seasonError ? "border-red-500/60" : "border-border-subtle",
                              )}
                            />
                            {seasonError && <p className="text-[10px] text-red-400">{seasonError}</p>}
                          </div>
                          <div className="space-y-1">
                            <label className="text-caption uppercase text-text-tertiary">
                              Episode{getMaxEpisode(parseInt(seasonInput) || 1) ? ` (max ${getMaxEpisode(parseInt(seasonInput) || 1)})` : ""}
                            </label>
                            <input
                              type="text" inputMode="numeric" value={episodeInput}
                              onChange={(e) => handleEpisodeChange(e.target.value)}
                              onBlur={() => { if (!episodeInput || parseInt(episodeInput) < 1) { setEpisodeInput("1"); setEpisodeError(null); } }}
                              className={cn(
                                "w-full bg-surface-overlay border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors",
                                episodeError ? "border-red-500/60" : "border-border-subtle",
                              )}
                            />
                            {episodeError && <p className="text-[10px] text-red-400">{episodeError}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* wantToWatch priority */}
                    {listContext === "wantToWatch" && (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-overlay flex items-start gap-2.5">
                          <Bookmark size={13} style={{ color: "var(--color-accent-watching-vivid)" }} className="shrink-0 mt-0.5" />
                          <p className="text-[11px] text-text-tertiary leading-relaxed">
                            Added to your <strong className="text-text-secondary">Want to Watch</strong> list. Rating is disabled until you&apos;ve watched it.
                          </p>
                        </div>
                        <div>
                          <label className="text-caption uppercase text-text-tertiary block mb-2">
                            Priority
                          </label>
                          <div className="flex gap-2">
                            {(["high", "medium", "low"] as const).map((level) => {
                              const cfg = PRIORITY_CONFIG[level];
                              const isActive = priorityLevel === level;
                              return (
                                <button
                                  key={level}
                                  type="button"
                                  onClick={() => setPriorityLevel(level)}
                                  className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-[background-color,border-color,color]",
                                    isActive
                                      ? `${cfg.activeBg} ${cfg.text}`
                                      : "bg-surface-overlay border-border-subtle text-text-tertiary hover:border-border-default hover:text-text-secondary",
                                  )}
                                >
                                  <div className={cn("h-2 w-2 rounded-full shrink-0", isActive ? cfg.dot : "bg-border-strong")} />
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="h-full flex flex-col items-center justify-center text-center py-16 gap-4">
                <div className="w-14 h-14 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center">
                  <Search size={24} className="text-text-tertiary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">
                    Find {defaultType === "film" ? "a movie" : defaultType === "serie" ? "a series" : "an anime"}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">Search to import from TMDB</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="gap-2 text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--color-accent-watching)" }}
            >
              {submitLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </Button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
