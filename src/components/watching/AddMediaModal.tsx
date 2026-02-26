/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  X,
  Upload,
  Star,
  Heart,
  Bookmark,
  Film,
  Calendar,
  Loader2,
  Plus,
  Trophy,
  History,
  Eye,
  Tag,
} from "lucide-react";
import { mapTmdbGenres } from "@/lib/tmdb-utils";
import { cn } from "@/lib/utils";

type ListType = "topTen" | "recentlyWatched" | "wantToWatch";
type MediaType = "film" | "serie" | "anime";

type AddMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  defaultType?: MediaType;
  listContext?: ListType;
};

export default function AddMediaModal({
  isOpen,
  onClose,
  onAdded,
  defaultType = "film",
  listContext = "recentlyWatched",
}: AddMediaModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [customPoster, setCustomPoster] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [favorite, setFavorite] = useState(false);

  const [priority, setPriority] = useState<number | null>(null);
  const [takenPriorities, setTakenPriorities] = useState<number[]>([]);

  //
  const [seasons, setSeasons] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<number | null>(null);
  // const [currentEpisode, setCurrentEpisode] = useState<number | null>(null);
  const [runtime, setRuntime] = useState<number | null>(null);
  const [directors, setDirectors] = useState<
    { name: string; profile_url: string | null }[] | null
  >(null);
  const [studio, setStudio] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fetchTakenPriorities = useCallback(async () => {
    if (listContext !== "topTen") return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("media_items")
      .select("priority")
      .eq("user_id", user.id)
      .eq("type", defaultType)
      .eq("favorite", true)
      .not("priority", "is", null);

    if (!error && data) {
      setTakenPriorities(data.map((item) => item.priority));
    }
  }, [listContext, defaultType]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setSearchQuery("");
        setSearchResults([]);
        setSelectedItem(null);
        setCustomPoster(null);
        setPreviewUrl(null);
        setUserRating(0);
        setNotes("");
        setFavorite(false);
        setPriority(null);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      fetchTakenPriorities();
    }
  }, [isOpen, fetchTakenPriorities]);

  const searchTMDB = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }
      setLoading(true);
      try {
        const endpoint =
          defaultType === "film"
            ? `https://api.themoviedb.org/3/search/movie`
            : `https://api.themoviedb.org/3/search/tv`;

        const res = await fetch(
          `${endpoint}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR&page=1`,
        );
        const data = await res.json();

        let results = data.results || [];

        if (defaultType === "anime") {
          results = results.filter(
            (r: any) =>
              r.genre_ids?.includes(16) || r.origin_country?.includes("JP"),
          );
        }

        setSearchResults(results.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [defaultType],
  );

  // const selectResult = async (result: any) => {
  //   setSelectedItem(result);
  //   setSearchQuery("");
  //   setSearchResults([]);

  //   try {
  //     const isMovie = result.media_type === "movie" || defaultType === "film";

  //     const endpoint = isMovie
  //       ? `https://api.themoviedb.org/3/movie/${result.id}`
  //       : `https://api.themoviedb.org/3/tv/${result.id}`;

  //     const res = await fetch(
  //       `${endpoint}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`,
  //     );

  //     const details = await res.json();

  //     let runtimeMinutes: number | null = null;

  //     if (isMovie) {
  //       // Film → runtime direct
  //       runtimeMinutes = details.runtime ?? null;
  //     } else {
  //       // Série / Anime → Logique plus robuste pour episode_run_time
  //       if (
  //         Array.isArray(details.episode_run_time) &&
  //         details.episode_run_time.length > 0
  //       ) {
  //         // On calcule la moyenne des durées indiquées (souvent plus précis)
  //         const sum = details.episode_run_time.reduce(
  //           (a: number, b: number) => a + b,
  //           0,
  //         );
  //         runtimeMinutes = Math.round(sum / details.episode_run_time.length);
  //       } else if (details.last_episode_to_air?.runtime) {
  //         // Secours : on prend la durée du dernier épisode diffusé
  //         runtimeMinutes = details.last_episode_to_air.runtime;
  //       } else {
  //         runtimeMinutes = null;
  //       }
  //     }

  //     setRuntime(runtimeMinutes);

  //     // Pour les séries et animes
  //     if (!isMovie) {
  //       setSeasons(details.number_of_seasons ?? null);
  //       setEpisodes(details.number_of_episodes ?? null);
  //     }
  //   } catch (err) {
  //     console.error("Erreur détails TMDB:", err);
  //     setRuntime(null);
  //   }
  // };

  // const selectResult = async (result: any) => {
  //   setSelectedItem(result);
  //   setSearchQuery("");
  //   setSearchResults([]);

  //   try {
  //     // 🔥 Détection du type
  //     const mediaType =
  //       result.media_type || (result.first_air_date ? "tv" : "movie");
  //     const isMovie = mediaType === "movie";

  //     const endpoint = isMovie
  //       ? `https://api.themoviedb.org/3/movie/${result.id}?append_to_response=credits`
  //       : `https://api.themoviedb.org/3/tv/${result.id}`;

  //     const res = await fetch(
  //       `${endpoint}&api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`,
  //     );
  //     const details = await res.json();

  //     console.log("📦 TMDB DETAILS:", details);

  //     // 🕒 Runtime
  //     let runtimeMinutes: number | null = null;
  //     if (isMovie) {
  //       runtimeMinutes = details.runtime ?? null;
  //     } else {
  //       if (
  //         Array.isArray(details.episode_run_time) &&
  //         details.episode_run_time.length > 0
  //       ) {
  //         const sum = details.episode_run_time.reduce(
  //           (a: number, b: number) => a + b,
  //           0,
  //         );
  //         runtimeMinutes = Math.round(sum / details.episode_run_time.length);
  //       } else if (details.last_episode_to_air?.runtime) {
  //         runtimeMinutes = details.last_episode_to_air.runtime;
  //       } else {
  //         runtimeMinutes = null;
  //       }
  //     }
  //     setRuntime(runtimeMinutes);

  //     // 📺 Séries / Anime
  //     if (!isMovie) {
  //       setSeasons(details.number_of_seasons ?? null);
  //       setEpisodes(details.number_of_episodes ?? null);
  //     }

  //     // 🎬 Directors, Studio et Status
  //     if (isMovie) {
  //       // Directors
  //       const crew = details.credits?.crew ?? [];
  //       const movieDirectors = crew
  //         .filter((m: any) => m.job === "Director")
  //         .map((d: any) => ({
  //           name: d.name,
  //           profile_url: d.profile_path
  //             ? `https://image.tmdb.org/t/p/w200${d.profile_path}`
  //             : null,
  //         }));
  //       setDirectors(movieDirectors.length ? movieDirectors : null);

  //       // Studio
  //       const company = details.production_companies?.[0]?.name ?? null;
  //       setStudio(company);

  //       // Status
  //       setStatus(details.status?.toLowerCase() ?? null);
  //     } else {
  //       // Pour séries/animes
  //       setDirectors(null); // optionnel : tu pourrais récupérer les showrunners si tu veux
  //       const networkName = details.networks?.[0]?.name ?? null;
  //       setStudio(networkName);

  //       const tvStatus = details.status?.toLowerCase() ?? null;
  //       setStatus(tvStatus === "ended" ? "ended" : "ongoing");
  //     }

  //     console.log("✅ Runtime:", runtimeMinutes);
  //     console.log("✅ Directors:", directors);
  //     console.log("✅ Studio:", studio);
  //     console.log("✅ Status:", status);
  //   } catch (err) {
  //     console.error("❌ Erreur détails TMDB:", err);
  //     setRuntime(null);
  //     setSeasons(null);
  //     setEpisodes(null);
  //     setDirectors(null);
  //     setStudio(null);
  //     setStatus(null);
  //   }
  // };

  const selectResult = async (result: any) => {
    setSelectedItem(result);
    setSearchQuery("");
    setSearchResults([]);

    try {
      const mediaType =
        result.media_type || (result.first_air_date ? "tv" : "movie");
      const isMovie = mediaType === "movie";

      // On ajoute credits pour les films ET les séries pour avoir les directeurs/créateurs
      const endpoint = isMovie
        ? `https://api.themoviedb.org/3/movie/${result.id}?append_to_response=credits`
        : `https://api.themoviedb.org/3/tv/${result.id}?append_to_response=credits`;

      const res = await fetch(
        `${endpoint}&api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR`,
      );
      const details = await res.json();

      // 🕒 Calcul du Runtime (Moyenne pour les séries)
      let runtimeMinutes: number | null = null;
      if (isMovie) {
        runtimeMinutes = details.runtime ?? null;
      } else {
        if (
          Array.isArray(details.episode_run_time) &&
          details.episode_run_time.length > 0
        ) {
          const sum = details.episode_run_time.reduce(
            (a: number, b: number) => a + b,
            0,
          );
          runtimeMinutes = Math.round(sum / details.episode_run_time.length);
        } else if (details.last_episode_to_air?.runtime) {
          runtimeMinutes = details.last_episode_to_air.runtime;
        }
      }

      // 🎬 Extraction des Directeurs / Créateurs
      let extractedDirectors = null;
      if (isMovie) {
        const crew = details.credits?.crew ?? [];
        extractedDirectors = crew
          .filter((m: any) => m.job === "Director")
          .map((d: any) => ({
            name: d.name,
            profile_url: d.profile_path
              ? `https://image.tmdb.org/t/p/w200${d.profile_path}`
              : null,
          }));
      } else {
        // Pour les séries, on prend les créateurs (Created By)
        extractedDirectors =
          details.created_by?.map((c: any) => ({
            name: c.name,
            profile_url: c.profile_path
              ? `https://image.tmdb.org/t/p/w200${c.profile_path}`
              : null,
          })) || null;
      }

      // 🏢 Studio / Network
      const extractedStudio = isMovie
        ? (details.production_companies?.[0]?.name ?? null)
        : (details.networks?.[0]?.name ?? null);

      // 📊 Status
      const rawStatus = details.status?.toLowerCase() ?? null;
      const extractedStatus = isMovie
        ? rawStatus
        : rawStatus === "ended"
          ? "ended"
          : "ongoing";

      // Mise à jour des états
      setRuntime(runtimeMinutes);
      setDirectors(extractedDirectors);
      setStudio(extractedStudio);
      setStatus(extractedStatus);

      if (!isMovie) {
        setSeasons(details.number_of_seasons ?? null);
        setEpisodes(details.number_of_episodes ?? null);
      }

      // IMPORTANT : On stocke les détails complets dans l'item sélectionné
      // pour que handleSubmit y ait accès sans attendre les états React
      setSelectedItem({
        ...result,
        ...details,
        runtimeMinutes,
        extractedDirectors,
        extractedStudio,
        extractedStatus,
      });
    } catch (err) {
      console.error("❌ Erreur détails TMDB:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomPoster(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem) return;
    if (listContext === "topTen" && priority === null) return;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return onClose();

      let posterUrl = selectedItem.poster_path
        ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
        : null;

      if (customPoster) {
        const filePath = `${user.id}/posters/${crypto.randomUUID()}.${customPoster.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("posters")
          .upload(filePath, customPoster);
        if (uploadError) throw new Error("Erreur upload image");
        const { data: urlData } = supabase.storage
          .from("posters")
          .getPublicUrl(filePath);
        posterUrl = urlData.publicUrl;
      }

      // const insertData = {
      //   user_id: user.id,
      //   type: defaultType,
      //   title: selectedItem.title || selectedItem.name,
      //   original_title:
      //     selectedItem.original_title || selectedItem.original_name,
      //   description: selectedItem.overview,
      //   poster_url: posterUrl,
      //   backdrop_url: selectedItem.backdrop_path
      //     ? `https://image.tmdb.org/t/p/original${selectedItem.backdrop_path}`
      //     : null,
      //   year:
      //     new Date(
      //       selectedItem.release_date || selectedItem.first_air_date,
      //     ).getFullYear() || null,
      //   runtime: runtime,
      //   rating: selectedItem.vote_average,

      //   // Champs obligatoires selon contexte
      //   user_rating: listContext === "wantToWatch" ? null : userRating,
      //   watched: listContext !== "wantToWatch",
      //   want_to_watch: listContext === "wantToWatch",
      //   favorite: listContext === "topTen" ? true : favorite,

      //   // Priority (Top 10 seulement)
      //   priority: listContext === "topTen" ? priority : null,

      //   // Champs séries / animes
      //   seasons:
      //     defaultType === "serie" || defaultType === "anime" ? seasons : null,
      //   episodes:
      //     defaultType === "serie" || defaultType === "anime" ? episodes : null,
      //   // current_episode:
      //   //   defaultType === "serie" || defaultType === "anime"
      //   //     ? currentEpisode
      //   //     : null,

      //   tmdb_id: selectedItem.id,
      //   tags: mapTmdbGenres(selectedItem.genre_ids),
      //   notes,
      //   watched_at:
      //     listContext === "recentlyWatched" ? new Date().toISOString() : null,
      // };
      const insertData = {
        user_id: user.id,
        type: defaultType,
        title: selectedItem.title || selectedItem.name,
        original_title:
          selectedItem.original_title || selectedItem.original_name,
        description: selectedItem.overview,
        poster_url: posterUrl,
        backdrop_url: selectedItem.backdrop_path
          ? `https://image.tmdb.org/t/p/original${selectedItem.backdrop_path}`
          : null,
        year:
          new Date(
            selectedItem.release_date || selectedItem.first_air_date,
          ).getFullYear() || null,
        runtime: runtime,
        rating: selectedItem.vote_average,

        // Champs obligatoires selon contexte
        user_rating: listContext === "wantToWatch" ? null : userRating,
        watched: listContext !== "wantToWatch",
        want_to_watch: listContext === "wantToWatch",
        favorite: listContext === "topTen" ? true : favorite,

        // Priority (Top 10 seulement)
        priority: listContext === "topTen" ? priority : null,

        // Champs séries / animes
        seasons:
          defaultType === "serie" || defaultType === "anime" ? seasons : null,
        episodes:
          defaultType === "serie" || defaultType === "anime" ? episodes : null,
        // current_episode: defaultType === "serie" || defaultType === "anime" ? currentEpisode : null,

        tmdb_id: selectedItem.id,
        tags: mapTmdbGenres(selectedItem.genre_ids),
        notes,
        watched_at:
          listContext === "recentlyWatched" ? new Date().toISOString() : null,

        // 🔹 Nouveaux champs
        directors: directors || null, // tableau JSON [{name, profile_url}, ...]
        studio: studio || null, // nom de la boîte ou réseau
        status: status || null, // "ended" ou "ongoing"
      };

      const { error } = await supabase.from("media_items").insert(insertData);
      if (error) throw error;

      onAdded();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout.");
    } finally {
      setLoading(false);
    }
  };

  const getHeaderInfo = () => {
    const typeLabel =
      defaultType === "film"
        ? "un Film"
        : defaultType === "serie"
          ? "une Série"
          : "un Anime";
    switch (listContext) {
      case "topTen":
        return {
          title: `Ajouter ${typeLabel} au Top 10`,
          desc: "Sélectionnez l'élite de votre collection.",
          icon: <Trophy className="text-amber-500" size={20} />,
        };
      case "recentlyWatched":
        return {
          title: `Ajouter ${typeLabel} aux Vus`,
          desc: "Gardez une trace de vos visionnages récents.",
          icon: <History className="text-blue-500" size={20} />,
        };
      case "wantToWatch":
        return {
          title: `Ajouter ${typeLabel} à Voir`,
          desc: "Planifiez vos futures découvertes.",
          icon: <Bookmark className="text-emerald-500" size={20} />,
        };
      default:
        return {
          title: "Ajouter un média",
          desc: "Enrichissez votre Second Brain.",
          icon: <Plus className="text-blue-500" size={20} />,
        };
    }
  };

  const header = getHeaderInfo();

  return (
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
            enterFrom="opacity-0 scale-95 translate-y-4"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-4"
          >
            <Dialog.Panel className="relative w-full max-w-3xl h-[85vh] md:h-[80vh] flex flex-col overflow-hidden rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl transition-all">
              {/* Header */}
              <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/5 bg-zinc-900/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 rounded-xl">{header.icon}</div>
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg md:text-xl font-bold text-white leading-none"
                    >
                      {header.title}
                    </Dialog.Title>
                    <p className="text-xs text-zinc-500 mt-1.5">
                      {header.desc}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
                {/* Search */}
                <div className="relative mb-6">
                  <div className="relative group">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder={`Rechercher ${defaultType === "film" ? "un film" : defaultType === "serie" ? "une série" : "un anime"}...`}
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-800/50 border border-white/5 rounded-2xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        searchTMDB(e.target.value);
                      }}
                    />
                    {loading && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2
                          className="animate-spin text-blue-500"
                          size={18}
                        />
                      </div>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                      {searchResults.map((res) => (
                        <button
                          key={res.id}
                          onClick={() => selectResult(res)}
                          className="w-full p-3 hover:bg-white/5 flex gap-4 text-left transition-colors border-b border-white/5 last:border-0"
                        >
                          <div className="relative w-10 h-14 shrink-0 bg-zinc-700 rounded overflow-hidden">
                            {res.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${res.poster_path}`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film
                                size={14}
                                className="text-zinc-500 m-auto"
                              />
                            )}
                          </div>
                          <div className="flex flex-col justify-center">
                            <p className="font-semibold text-white text-sm line-clamp-1">
                              {res.title || res.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {res.release_date?.slice(0, 4) ||
                                res.first_air_date?.slice(0, 4)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedItem ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
                    {/* Media Preview */}
                    <div className="relative overflow-hidden rounded-2xl bg-zinc-800/30 border border-white/5 p-4 md:p-5 flex flex-col sm:flex-row gap-6">
                      <div className="absolute inset-0 -z-10 opacity-30 blur-3xl scale-110">
                        <img
                          src={
                            previewUrl ||
                            (selectedItem.poster_path
                              ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
                              : "/placeholder.png")
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="relative group shrink-0 mx-auto sm:mx-0">
                        <div className="w-32 md:w-36 aspect-2/3 rounded-xl overflow-hidden shadow-xl border border-white/10">
                          <img
                            src={
                              previewUrl ||
                              (selectedItem.poster_path
                                ? `https://image.tmdb.org/t/p/w500${selectedItem.poster_path}`
                                : "/placeholder.png")
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl backdrop-blur-sm">
                          <Upload size={20} className="text-white mb-1" />
                          <span className="text-[10px] font-medium text-white">
                            Custom
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex-1 space-y-3">
                        <h4 className="text-lg font-bold text-white leading-tight">
                          {selectedItem.title || selectedItem.name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                            <Star size={12} className="fill-amber-400" />
                            {selectedItem.vote_average?.toFixed(1)}
                          </div>
                          <div className="flex items-center gap-1 text-zinc-400 text-[11px]">
                            <Calendar size={12} />
                            {selectedItem.release_date?.slice(0, 4) ||
                              selectedItem.first_air_date?.slice(0, 4)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {mapTmdbGenres(selectedItem.genre_ids).map(
                            (genre: string) => (
                              <span
                                key={genre}
                                className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-[10px] text-zinc-300 font-medium flex items-center gap-1"
                              >
                                <Tag size={8} className="text-blue-400" />
                                {genre}
                              </span>
                            ),
                          )}
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 italic">
                          {selectedItem.overview}
                        </p>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-5">
                        {/* Rating Progress Bar (Slider) */}
                        {listContext !== "wantToWatch" && (
                          <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <Star size={14} className="text-blue-500" />{" "}
                                Votre note
                              </span>
                              <span className="text-blue-500 font-black text-base">
                                {userRating > 0 ? userRating.toFixed(1) : "--"}
                              </span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.5"
                              value={userRating}
                              onChange={(e) =>
                                setUserRating(parseFloat(e.target.value))
                              }
                              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        )}

                        {/* Ranking Top 10 (Priority) - Single Line */}
                        {listContext === "topTen" && (
                          <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Trophy size={14} className="text-amber-500" />{" "}
                              Classement Top 10
                            </label>
                            <div className="flex justify-between gap-1">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                                const isTaken = takenPriorities.includes(num);
                                return (
                                  <button
                                    key={num}
                                    disabled={isTaken}
                                    onClick={() => setPriority(num)}
                                    className={cn(
                                      "flex-1 h-8 rounded-lg text-[10px] font-bold transition-all border",
                                      priority === num
                                        ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20"
                                        : isTaken
                                          ? "bg-amber-500/20 border-amber-500/30 text-amber-500 cursor-not-allowed"
                                          : "bg-zinc-800/50 border-white/5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300",
                                    )}
                                  >
                                    {num}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            Notes personnelles
                          </label>
                          <textarea
                            placeholder="Vos impressions..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-4 bg-zinc-800/50 border border-white/5 rounded-2xl text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 h-24 resize-none transition-all"
                          />
                        </div>
                        {/* Champs séries / animes */}
                        {/* {(defaultType === "serie" ||
                          defaultType === "anime") && (
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-bold text-zinc-500">
                                Saisons
                              </label>
                              <input
                                type="number"
                                value={seasons || ""}
                                onChange={(e) =>
                                  setSeasons(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  )
                                }
                                className="w-full p-3 bg-zinc-800/50 border border-white/5 rounded-2xl text-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-zinc-500">
                                Épisodes
                              </label>
                              <input
                                type="number"
                                value={episodes || ""}
                                onChange={(e) =>
                                  setEpisodes(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  )
                                }
                                className="w-full p-3 bg-zinc-800/50 border border-white/5 rounded-2xl text-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-zinc-500">
                                Épisode actuel
                              </label>
                              <input
                                type="number"
                                value={currentEpisode || ""}
                                onChange={(e) =>
                                  setCurrentEpisode(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  )
                                }
                                className="w-full p-3 bg-zinc-800/50 border border-white/5 rounded-2xl text-white"
                              />
                            </div>
                          </div>
                        )} */}
                      </div>

                      {/* Options Section */}
                      <div className="space-y-4">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                          Statut & Options
                        </label>

                        <div className="space-y-3">
                          {listContext === "topTen" && (
                            <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-start gap-3">
                              <Trophy
                                className="text-amber-500 shrink-0"
                                size={18}
                              />
                              <p className="text-[11px] text-amber-200/60 leading-relaxed">
                                Ce média sera ajouté à votre{" "}
                                <strong>Top 10</strong>. Il est automatiquement
                                marqué comme favori et vu.
                              </p>
                            </div>
                          )}

                          {listContext === "recentlyWatched" && (
                            <>
                              <button
                                onClick={() => setFavorite(!favorite)}
                                className={cn(
                                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                  favorite
                                    ? "bg-rose-500/10 border-rose-500/50 text-rose-400"
                                    : "bg-zinc-800/50 border-white/5 text-zinc-400",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <Heart
                                    size={18}
                                    className={favorite ? "fill-rose-500" : ""}
                                  />
                                  <span className="text-sm font-medium">
                                    Ajouter aux favoris
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                    favorite
                                      ? "border-rose-500 bg-rose-500"
                                      : "border-zinc-600",
                                  )}
                                >
                                  {favorite && (
                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                  )}
                                </div>
                              </button>
                              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-center gap-2">
                                <Eye size={14} className="text-blue-400" />
                                <p className="text-[10px] text-blue-400/70">
                                  Sera marqué comme vu aujourd hui.
                                </p>
                              </div>
                            </>
                          )}

                          {listContext === "wantToWatch" && (
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-3">
                              <Bookmark
                                className="text-emerald-500 shrink-0"
                                size={18}
                              />
                              <p className="text-[11px] text-emerald-200/60 leading-relaxed">
                                Ajouté à votre liste <strong>À regarder</strong>
                                . La note et les favoris sont désactivés car
                                vous ne l avez pas encore vu.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-16 space-y-4">
                    <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center border border-white/5">
                      <Search size={28} className="text-zinc-700" />
                    </div>
                    <div>
                      <h4 className="text-base font-medium text-white">
                        Trouver{" "}
                        {defaultType === "film"
                          ? "un film"
                          : defaultType === "serie"
                            ? "une série"
                            : "un anime"}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        Recherchez pour importer les données TMDB.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 md:p-6 border-t border-white/5 bg-zinc-900/80 backdrop-blur-md flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    !selectedItem ||
                    (listContext === "topTen" &&
                      (userRating === 0 || priority === null))
                  }
                  className={cn(
                    "px-7 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                    loading ||
                      !selectedItem ||
                      (listContext === "topTen" && priority === null)
                      ? "bg-zinc-800 text-zinc-600"
                      : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20",
                  )}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  Ajouter
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #18181b;
        }
      `}</style>
    </Transition>
  );
}
