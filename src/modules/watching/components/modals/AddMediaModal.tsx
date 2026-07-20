/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useOwnedTmdbIds } from "@/modules/watching/hooks/useOwnedTmdbIds";
import { useAnimeCours } from "@/modules/watching/hooks/useAnimeCours";
import { shouldOverlay, courToFlat, tmdbFromFlat } from "@/modules/watching/lib/anime-overlay";
import { buildMediaView } from "@/modules/watching/lib/media-view";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Search, X, Upload, Star, Heart, Bookmark,
  Film, Calendar, Loader2, Plus, Trophy,
  History, Eye, Tag, Play, AlertCircle, Check,
} from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { mapTmdbGenres } from "@/modules/watching/lib/media-utils";
import { airedFromTmdb } from "@/modules/watching/lib/series-state";
import { HowFarDidYouGet, type Position, type Stance } from "./HowFarDidYouGet";
import { useAddMedia } from "@/modules/watching/hooks/useAddMedia";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { RatingPicker } from "@/modules/watching/components/shared/RatingPicker";
import { WatchDatePicker } from "@/modules/watching/components/shared/WatchDatePicker";
import { buildWatchedAt, type WatchDateParts } from "@/modules/watching/lib/watched-date";
import { cn } from "@/shared/utils/utils";
import { Button } from "@/shared/components/ui/button";
import { getTakenPriorities, getExistingMediaEntry, uploadCustomPoster } from "@/modules/watching/service";
import { resolveTransition } from "@/modules/watching/lib/resolve-transition";
import type { ListType, MediaType, TmdbModalResult, WatchingMedia } from "@/modules/watching/types";

type AddMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (item?: any) => void;
  defaultType?: MediaType;
  listContext?: ListType;
  initialItem?: any;
};


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
  const router = useRouter();
  const userId = useCurrentUserId();
  // Which of these results you ALREADY own — so a search doesn't invite you to re-add a title you
  // have, it sends you to manage it where all its actions live: its detail page.
  const { data: ownedIds = [] } = useOwnedTmdbIds(userId ?? "", defaultType, isOpen && !!userId);
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

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

  const [watchDate, setWatchDate] = useState<WatchDateParts>({ year: new Date().getFullYear(), month: null, day: null });

  const [seasons, setSeasons]         = useState<number | null>(null);
  const [episodes, setEpisodes]       = useState<number | null>(null);
  const [seasonInput, setSeasonInput] = useState<string>("1");
  const [episodeInput, setEpisodeInput] = useState<string>("1");
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  // For a SERIES, the position is the only honest input — the list you came from no longer
  // decides your status. Null = not answered yet.
  const [position, setPosition] = useState<Position | null>(null);
  const [stance, setStance] = useState<Stance>("watching");
  const [seasonAired, setSeasonAired] = useState<number[]>([]);
  // When each season FINISHED airing (its last aired episode). Fetched on demand, cached.
  const [seasonEnd, setSeasonEnd] = useState<Record<number, string>>({});
  const [runtime, setRuntime]         = useState<number | null>(null);
  const [directors, setDirectors]     = useState<{ id?: number; name: string; profile_url: string | null }[] | null>(null);
  const [cast, setCast]               = useState<{ id: number; name: string; character: string | null; profile_url: string | null }[]>([]);
  const [studio, setStudio]           = useState<string | null>(null);
  const [status, setStatus]           = useState<string | null>(null);

  const addMediaMutation = useAddMedia();

  // YOU CANNOT HAVE WATCHED A SEASON BEFORE IT FINISHED AIRING. Season 3 of an anime that ran
  // Oct 2019 → Mar 2020 cannot have been watched in 2014, and the year picker used to offer it
  // (its floor was the SHOW's first air date). So the floor follows the season you claim: we
  // fetch that season's last aired episode, once, and cache it.
  useEffect(() => {
    const season = position?.season;
    if (!season || !selectedItem?.id || seasonEnd[season] !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tmdb?endpoint=tv/${selectedItem.id}/season/${season}&language=en-US`);
        const data = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        const aired = (data.episodes ?? [])
          .map((e: any) => e.air_date as string | null)
          .filter((d: string | null): d is string => !!d && d <= today);
        if (!cancelled && aired.length) {
          setSeasonEnd((prev) => ({ ...prev, [season]: aired[aired.length - 1] }));
        }
      } catch { /* fall back to the show's release year */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.season, selectedItem?.id]);

  const isSeries = defaultType === "serie" || defaultType === "anime";

  // ── Fetch taken priorities ─────────────────────────────────────────────────

  const fetchTakenPriorities = useCallback(async () => {
    if (listContext !== "topTen") return;
    setTakenPriorities(await getTakenPriorities(defaultType));
  }, [listContext, defaultType]);

  // ── Revoke the custom-poster object URL on change/unmount ───────────────────
  // Covers every path that drops previewUrl (close, repick, unmount, swap) so the
  // image blob never lingers in memory — important on mobile Safari.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
        setPosition(null); setStance("watching"); setSeasonAired([]); setSeasonEnd({});
        setWatchDate({ year: new Date().getFullYear(), month: null, day: null });
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
      const res        = await fetch(`/api/tmdb?endpoint=${isMovie ? `movie/${result.id}` : `tv/${result.id}`}&append_to_response=credits,aggregate_credits&language=en-US`);
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
            .map((d) => ({ id: d.id, name: d.name, profile_url: d.profile_path ? `https://image.tmdb.org/t/p/w200${d.profile_path}` : null }))
        : (details.created_by ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            profile_url: c.profile_path ? `https://image.tmdb.org/t/p/w200${c.profile_path}` : null,
          }));

      // Cast — movies expose it on credits.cast; TV/anime recurring cast lives on
      // aggregate_credits.cast (character is under roles[]). Cached (top 12) so the
      // detail page renders Cast & Crew from the DB with no extra TMDB call.
      const rawCast: any[] = isMovie
        ? (details.credits?.cast ?? [])
        : (details.aggregate_credits?.cast ?? []);
      const extractedCast = rawCast.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character ?? p.roles?.[0]?.character ?? null,
        profile_url: p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null,
      }));

      const extractedStudio  = isMovie ? (details.production_companies?.[0]?.name ?? null) : (details.networks?.[0]?.name ?? null);
      const rawStatus        = details.status?.toLowerCase() ?? null;
      const extractedStatus  = isMovie ? rawStatus : (rawStatus === "ended" ? "ended" : "ongoing");

      // TMDB's `last_episode_to_air` is its own answer to "what is the newest episode that
      // EXISTS" — House of the Dragon returns S3 E4. It rides along in the call we already make,
      // so a title can be BORN knowing what has aired instead of waiting for the nightly sync.
      setSeasonAired(
        isMovie
          ? []
          : airedFromTmdb(
              (details.seasons ?? []) as { season_number: number; episode_count: number }[],
              details.last_episode_to_air as { season_number: number; episode_number: number } | undefined,
            ),
      );
      setPosition(null);
      setStance("watching");
      setSeasonEnd({});

      setRuntime(runtimeMinutes);
      setDirectors(extractedDirectors);
      setCast(extractedCast);
      setStudio(extractedStudio);
      setStatus(extractedStatus);
      if (!isMovie) { setSeasons(details.number_of_seasons ?? null); setEpisodes(details.number_of_episodes ?? null); }

      // TMDB speaks two dialects: /search returns `genre_ids: number[]`, /movie/{id} returns
      // `genres: {id,name}[]`. We stored the genres from `genre_ids` only — which works when
      // the pick came from the search list, and silently yields NO categories when the caller
      // hands us an item that never went through search (the person page's filmography, where
      // a credit carries no genres). Translating the details dialect here fixes it for EVERY
      // caller, present and future — the modal is the one place that always sees both.
      const detailGenres: number[] = (details.genres ?? []).map((g: { id: number }) => g.id);
      const merged: TmdbModalResult = {
        ...result,
        ...details,
        poster_path:   result.poster_path   ?? details.poster_path,
        backdrop_path: result.backdrop_path ?? details.backdrop_path,
        genre_ids: detailGenres.length ? detailGenres : (result.genre_ids ?? []),
      };
      setSelectedItem(merged);

      // Check for existing entry
      const existing = await getExistingMediaEntry(defaultType, result.id);

      if (existing) {
        setUserRating(existing.user_rating ?? 0);
        setNotes(existing.notes ?? "");
        setFavorite(existing.favorite ?? false);
        if (listContext === "inProgress") {
          setSeasonInput(String(existing.current_season ?? 1));
          setEpisodeInput(String(existing.current_episode ?? 1));
        }
      }

      // The resolver runs even for a title you DON'T own — a brand-new series that is still airing,
      // arriving through the "Recently Watched" door, is the same impossible claim as an owned one.
      // It needs the world's facts (is it over?), and `extractedStatus` is them: the state setter
      // above hasn't landed yet, so we hand it the value, not the stale state.
      const releaseSource = isMovie ? details.release_date : details.first_air_date;
      const transition = resolveTransition(existing, listContext, {
        type: defaultType,
        status: extractedStatus,
        year: releaseSource ? new Date(releaseSource).getFullYear() : null,
        release_date: isMovie ? (details.release_date ?? null) : null,
      });
      setConflict(
        transition.message
          ? { existingLists: transition.existingLists, canAdd: transition.allowed, message: transition.message }
          : null,
      );
    } catch {
      toast.error("Failed to fetch media details.");
    }
  };

  // A title you already own → go MANAGE it, don't re-add it. Its detail page is where every action
  // lives (mark watched, rate, rank, drop). The one exception is the Top 10 door: ranking an owned
  // title is a real transition the detail page can't yet do, so that context keeps the add flow.
  // (Moving "Rank in Top 10" to the detail page would retire this exception — noted as follow-up.)
  const seeDetails = async (res: TmdbModalResult) => {
    const existing = await getExistingMediaEntry(defaultType, res.id);
    if (existing) { onClose(); router.push(`/perso/watching/${existing.id}`); }
    else selectResult(res);   // ownership set was stale — fall back to the add flow
  };

  const routeToDetails = (res: TmdbModalResult) => ownedSet.has(res.id) && listContext !== "topTen";

  // Auto-select initialItem when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen && initialItem) selectResult(initialItem); }, [isOpen]);

  // ── Season / episode validation ───────────────────────────────────────────

  // ── ANIME v2 — the AniList cour overlay, at THIS door too. ─────────────────────────────────
  // TMDB flattens many anime into a single season (Blue Lock: 1 season, 38 episodes) while the
  // rest of the app shows the real cours (2 seasons). This modal read TMDB directly, so "Start
  // watching" offered "Season (max 1)" on a title whose fiche displays two — the same position
  // meaning different things depending on which door you came through. That is exactly the drift
  // watch-status.ts killed for STATUSES; this is its equivalent for POSITIONS.
  // The inputs now speak COUR coordinates. Storage stays TMDB-flat, converted once on save.
  const tmdbSeasonEpisodes: number[] = useMemo(
    () =>
      Array.isArray(selectedItem?.seasons)
        ? selectedItem.seasons
            .filter((s: { season_number: number }) => s.season_number > 0)
            .map((s: { episode_count?: number }) => s.episode_count ?? 0)
        : [],
    [selectedItem],
  );
  const { data: coursRow } = useAnimeCours(selectedItem?.id ?? 0, defaultType === "anime" && !!selectedItem?.id);
  const overlayCours = shouldOverlay({ type: defaultType, season_episodes: tmdbSeasonEpisodes }, coursRow)
    ? coursRow.cours
    : null;

  /**
   * THE LENS, FOR A TITLE THAT IS NOT YOURS YET.
   *
   * Everywhere else the view is built from your row; here there is no row — so we build it from the
   * TMDB payload plus the shared cours. Same object, same rules, so this door speaks cours like the
   * rest of the app: "Through S1" of a lumped anime means cour 1, and the year it stamps lands in
   * `cour_years` instead of a `season_years` map the Watch History never reads.
   */
  const addView = useMemo(
    () =>
      buildMediaView(
        {
          type: defaultType,
          status: (status ?? undefined) as WatchingMedia["status"],
          caught_up_at: null,
          episodes: undefined,
          season_episodes: tmdbSeasonEpisodes,
          season_aired: seasonAired,
          season_posters: null,
          season_end_dates: null,
          current_season: undefined,
          current_episode: undefined,
          season_years: null,
          season_ratings: null,
          cour_years: null,
          cour_ratings: null,
        },
        coursRow,
      ),
    [defaultType, status, tmdbSeasonEpisodes, seasonAired, coursRow],
  );

  const maxSeason = overlayCours ? overlayCours.length : seasons;

  const getMaxEpisode = (season: number): number | null => {
    if (overlayCours) return overlayCours.find((c) => c.season === season)?.episodes ?? null;
    if (!selectedItem?.seasons || !Array.isArray(selectedItem.seasons)) return null;
    const s = selectedItem.seasons.find((s) => s.season_number === season);
    return s?.episode_count ?? null;
  };

  /** What the inputs claim, in TMDB coordinates — the only shape storage accepts. */
  const storedPosition = (): { season: number; episode: number } => {
    const season = parseInt(seasonInput) || 1;
    const episode = parseInt(episodeInput) || 1;
    if (!overlayCours) return { season, episode };
    return tmdbFromFlat(tmdbSeasonEpisodes, courToFlat(season, episode, overlayCours));
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

      // One construction rule, shared with the detail-page edit — see buildWatchedAt.
      const watchedAt = listContext === "library" ? buildWatchedAt(watchDate) : null;
      // THE IN PROGRESS DOOR STATES A CLAIM TOO — it always collected one and threw it away.
      //
      // Its season/episode fields went off as `currentSeason/currentEpisode`, a channel that decided
      // nothing, while `position` — the only input the status is derived from — stayed null. So the
      // status derivation answered "you claimed nothing", every flag fell to false, and a series
      // added here landed in no rail at all. Same fields, same numbers; they are simply routed to
      // the input that means something. (Cour coordinates in, TMDB coordinates out — storedPosition.)
      // Both doors now speak DISPLAY units — the In Progress fields via `storedPosition` (which has
      // always converted), and HowFarDidYouGet because it is fed the lens's seasons. One conversion
      // at this boundary and storage gets what it expects.
      const claimedPosition =
        listContext === "inProgress" && isSeries
          ? storedPosition()
          : position
            ? addView.toStorage(position.season, position.episode)
            : null;

      const result = await addMediaMutation.mutateAsync({
        selectedItem, defaultType, listContext,
        userRating, notes, favorite, priority, priorityLevel,
        seasons, episodes, runtime, directors, cast, studio, status,
        customPosterUrl: finalPosterUrl,
        genres: mapTmdbGenres(selectedItem.genre_ids),
        watchedAt,
        position: claimedPosition,
        stance,
        view: addView,
      });

      toast.success("Added to your collection.");
      onAdded(result);
      onClose();
    } catch (err) {
      if (isDemoReadOnlyError(err)) { onClose(); return; }
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
      case "recentlyWatched": return { title: `Add ${typeLabel} to Last Watched`,        icon: <History  size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      case "wantToWatch":     return { title: `Add ${typeLabel} to Want to Watch`,      icon: <Bookmark size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      case "library":         return { title: `Add to Library`,                          icon: <Film     size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
      default:                return { title: "Add Media",                               icon: <Plus     size={16} style={{ color: "var(--color-accent-watching-vivid)" }} /> };
    }
  }, [defaultType, listContext]);

  // ── Watched-date floor (library only) — the picker owns the rest of the bounds ──────────

  const releaseStr  = selectedItem?.release_date || selectedItem?.first_air_date || "";
  const releaseYear  = releaseStr ? parseInt(releaseStr.slice(0, 4)) : 1900;
  const releaseMonth = releaseStr ? parseInt(releaseStr.slice(5, 7)) || 1 : 1;

  // The earliest year you could POSSIBLY have watched what you claim: the year the season you
  // picked finished airing. Falls back to the show's release year while the fetch is in flight.
  // (The month/day bounds now live inside WatchDatePicker.)
  const claimedEnd = position ? seasonEnd[position.season] : undefined;
  const floorYear = claimedEnd ? parseInt(claimedEnd.slice(0, 4)) : releaseYear;
  const floorMonth = claimedEnd ? (parseInt(claimedEnd.slice(5, 7)) || 1) : releaseMonth;

  useEffect(() => {
    if (watchDate.year < floorYear) setWatchDate((d) => ({ ...d, year: floorYear, month: null, day: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorYear]);

  // ── Disable logic (aligned between footer and handleSubmit) ───────────────

  // A SERIES MAY NOT BE ADDED WITHOUT SAYING HOW FAR YOU GOT.
  //
  // The status of a series comes from its POSITION and nothing else — so a claim door with no claim
  // has no status to write. The write refuses it (addStatusPatch returns null, insertMediaSchema
  // refuses the row), and this is that same rule said EARLY, where it is a sentence instead of an
  // error: the question is right there on screen, unanswered.
  const needsClaim =
    isSeries &&
    (listContext === "library" || listContext === "recentlyWatched" || listContext === "topTen") &&
    !position;

  const isSubmitDisabled =
    submitLoading ||
    !selectedItem ||
    conflict?.canAdd === false ||
    needsClaim ||
    (listContext === "topTen" && priority === null);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-modal border border-border-strong bg-surface-2 focus:outline-none"
          style={{ height: "85vh", maxHeight: "85vh" }}
        >

          {/* ── Header ── */}
          <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-control bg-surface-2 border border-border-subtle">
                {header.icon}
              </div>
              <Dialog.Title className="text-sm font-semibold text-text-primary">
                {header.title}
              </Dialog.Title>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-control text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors"
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
                  className="w-full rounded-card border border-border-subtle bg-surface-overlay pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus transition-colors"
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
                <div className="absolute top-full left-0 right-0 mt-1.5 z-20 overflow-hidden rounded-control border border-border-strong bg-surface-3 shadow-md max-h-64 overflow-y-auto custom-scrollbar">
                  {searchResults.map((res) => {
                    const owned = ownedSet.has(res.id);
                    const toDetails = routeToDetails(res);
                    // A film whose release YEAR is still ahead cannot be watched — so it cannot enter
                    // a watched door (library / recently watched / top 10). We say why, right on the
                    // row, and refuse the click, instead of accepting it and then apologising in a
                    // banner. (Want to Watch stays open — you can plan for it.)
                    const resYear = (res.release_date || res.first_air_date)?.slice(0, 4);
                    const unreleased = defaultType === "film" && !!resYear && Number(resYear) > new Date().getFullYear();
                    const blocked = !owned && unreleased && listContext !== "wantToWatch";
                    return (
                    <button
                      key={res.id}
                      type="button"
                      disabled={blocked}
                      onClick={() => (toDetails ? seeDetails(res) : selectResult(res))}
                      className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 text-left transition-colors border-b border-border-subtle last:border-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                    >
                      <div className="relative w-9 h-13 shrink-0 overflow-hidden rounded-chip bg-surface-2">
                        {res.poster_path
                          ? <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} alt="" className="w-full h-full object-cover" />
                          : <Film size={14} className="text-text-tertiary absolute inset-0 m-auto" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary line-clamp-1">{res.title || res.name}</p>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {res.release_date?.slice(0, 4) || res.first_air_date?.slice(0, 4)}
                        </p>
                      </div>
                      {/* Already yours → say so, and point at the door that manages it. */}
                      {owned && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-micro font-medium text-accent-watching-vivid">
                          <Check size={11} />
                          {toDetails ? "See details" : "In library"}
                        </span>
                      )}
                      {blocked && (
                        <span className="shrink-0 text-micro font-medium text-text-tertiary">Not out yet</span>
                      )}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Conflict banner */}
            {conflict && (
              <div className={cn(
                "flex items-start gap-2 px-3 py-2.5 rounded-control text-xs mb-5 border",
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
                <div className="relative overflow-hidden rounded-card bg-surface-2/50 border border-border-subtle p-4 flex flex-col sm:flex-row gap-5">
                  {/* blurred bg — rendered ONLY when there is a source. `src=""` makes the browser
                      re-request the whole page, so an absent poster must mean an absent <img>. */}
                  {(previewUrl || selectedItem.poster_path) && (
                    <div className="absolute inset-0 -z-10 opacity-50 blur-3xl scale-110 pointer-events-none">
                      <img
                        src={previewUrl || `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`}
                        alt="" className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Poster */}
                  <div className="relative group shrink-0 mx-auto sm:mx-0">
                    <div className="w-28 aspect-2/3 rounded-tile overflow-hidden border border-border-subtle">
                      <img
                        src={previewUrl || (selectedItem.poster_path ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}` : "/placeholder.png")}
                        alt="" className="w-full h-full object-cover"
                      />
                    </div>
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-control">
                      <Upload size={18} className="text-white mb-1" />
                      <span className="text-micro font-medium text-white">Custom</span>
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { setCustomPoster(file); setPreviewUrl(URL.createObjectURL(file)); }
                      }} className="hidden" />
                    </label>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <h4 className="text-base font-bold text-text-primary leading-tight">
                      {selectedItem.title || selectedItem.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-chip text-micro font-semibold">
                        <Star size={11} className="fill-amber-400" />
                        {selectedItem.vote_average?.toFixed(1)}
                      </div>
                      <div className="flex items-center gap-1 text-text-tertiary text-micro">
                        <Calendar size={11} />
                        {selectedItem.release_date?.slice(0, 4) || selectedItem.first_air_date?.slice(0, 4)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mapTmdbGenres(selectedItem.genre_ids).map((genre) => (
                        <span key={genre} className="px-2 py-0.5 bg-surface-overlay border border-border-subtle rounded-chip text-micro text-text-secondary flex items-center gap-1">
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
                        <div className="rounded-card bg-accent-watching p-4">
                          <RatingPicker value={userRating} onChange={setUserRating} />
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
                                  "flex-1 h-8 rounded-control text-micro font-bold transition-[background-color,border-color,color] border",
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
                        className="w-full p-3.5 bg-surface-overlay border border-border-subtle rounded-card text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus h-24 resize-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    <SectionLabel>Status &amp; Options</SectionLabel>

                    {/* topTen info box */}
                    {listContext === "topTen" && (
                      <div className="p-4 bg-amber-500/5 rounded-card border border-amber-500/10 flex items-start gap-3">
                        <Trophy size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-micro text-amber-200/60 leading-relaxed">
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
                          "w-full flex items-center justify-between p-3.5 rounded-card border transition-[background-color,border-color,color]",
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

                    {/* "Marked as watched today." — said flatly, from the button you pressed, on
                        anything you added here. On a series that is still airing it is simply false,
                        and it was sitting three centimetres above the very question ("How far did
                        you get?") whose answer decides the truth. A film has no such question, so it
                        keeps its line; a series gets its answer from HowFarDidYouGet's live
                        "Recorded as …", which reads your position instead of your intent. */}
                    {listContext === "recentlyWatched" && !isSeries && (
                      <div className="p-3 rounded-card border border-border-subtle bg-surface-overlay flex items-center gap-2">
                        <Eye size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
                        <p className="text-micro text-text-tertiary">Marked as watched today.</p>
                      </div>
                    )}

                    {/* THE QUESTION. Only where it was missing: the three doors that used to
                        assert "watched" on your behalf (library / recentlyWatched / topTen).
                        Want-to-watch and In-Progress already answer it by construction. */}
                    {(defaultType === "serie" || defaultType === "anime") &&
                      seasonAired.length > 0 &&
                      (listContext === "library" || listContext === "recentlyWatched" || listContext === "topTen") && (
                        <HowFarDidYouGet
                          seasonAired={addView.seasons.map((s) => s.aired)}
                          status={status}
                          value={position}
                          onChange={setPosition}
                          stance={stance}
                          onStanceChange={setStance}
                        />
                      )}

                    {/* THE DATE. Removing it was a mistake: declaring "I watched three seasons" is a
                        statement about the PAST, and the past must be datable. It isn't gone — it's
                        re-pointed. The year you give now STAMPS the seasons you claimed (see
                        useAddMedia), which is where a series' viewing dates have always lived.
                        It appears as soon as you've said how far you got. */}
                    {listContext === "library" && (!isSeries || !!position) && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-caption uppercase text-text-tertiary block">
                            When did you watch it?
                          </label>
                          <WatchDatePicker value={watchDate} onChange={setWatchDate} minYear={floorYear} minMonth={floorMonth} />
                        </div>
                        <div className="p-3 rounded-card border border-border-subtle bg-surface-overlay flex items-center gap-2">
                          <Film size={13} style={{ color: "var(--color-accent-watching-vivid)" }} />
                          <p className="text-micro text-text-tertiary">Archived in your library.</p>
                        </div>
                      </div>
                    )}

                    {/* inProgress season/episode */}
                    {listContext === "inProgress" && (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-card border border-border-subtle bg-surface-overlay flex items-start gap-2.5">
                          <Play size={13} style={{ color: "var(--color-accent-watching-vivid)" }} className="shrink-0 mt-0.5" />
                          <div>
                            <p className="text-micro text-text-secondary leading-relaxed">Set where you are to track your progress.</p>
                            <p className="text-micro text-text-tertiary mt-0.5 leading-relaxed">Season/episode follows TMDB structure.</p>
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
                                "w-full bg-surface-overlay border rounded-control px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors",
                                seasonError ? "border-red-500/60" : "border-border-subtle",
                              )}
                            />
                            {seasonError && <p className="text-micro text-red-400">{seasonError}</p>}
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
                                "w-full bg-surface-overlay border rounded-control px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-focus transition-colors",
                                episodeError ? "border-red-500/60" : "border-border-subtle",
                              )}
                            />
                            {episodeError && <p className="text-micro text-red-400">{episodeError}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* wantToWatch priority */}
                    {listContext === "wantToWatch" && (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-card border border-border-subtle bg-surface-overlay flex items-start gap-2.5">
                          <Bookmark size={13} style={{ color: "var(--color-accent-watching-vivid)" }} className="shrink-0 mt-0.5" />
                          <p className="text-micro text-text-tertiary leading-relaxed">
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
                                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-card text-xs font-semibold border transition-[background-color,border-color,color]",
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
                <div className="w-14 h-14 rounded-card bg-surface-2 border border-border-subtle flex items-center justify-center">
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
            {needsClaim && selectedItem && (
              <p className="mr-auto text-micro text-text-tertiary">Tell us how far you got first.</p>
            )}
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
            >
              Cancel
            </Button>
            <Button variant="legacy"
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
