/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Star, Heart, X, Play, Plus, Info } from "lucide-react";
import type { WatchItem } from "@/lib/watching-data";
import { cn } from "@/lib/utils";

type MediaDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: WatchItem;
};

export default function MediaDetailModal({
  isOpen,
  onClose,
  item,
}: MediaDetailModalProps) {
  const [notes, setNotes] = useState(item.notes || "");
  // const [favorite, setFavorite] = useState(item.favorite);
  // const [watched, setWatched] = useState(false);
  const [saving, setSaving] = useState(false);
  // const [inWatchlist, setInWatchlist] = useState(item.watched);

  const [watched, setWatched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (item) {
      setWatched(item.watched);
      setFavorite(item.favorite);
      setInWatchlist(!item.watched);
    }
  }, [item]);

  useEffect(() => {
    if (isOpen) {
      setNotes(item.notes || "");
      setFavorite(item.favorite);
    }
  }, [isOpen, item]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("media_items")
        .update({ notes, favorite })
        .eq("id", item.id);
      if (error) throw error;
      onClose();
    } catch (err) {
      console.error("Erreur sauvegarde:", err);
    } finally {
      setSaving(false);
    }
  };

  const [similarTitles, setSimilarTitles] = useState<any[]>([]);

  useEffect(() => {
    if (!item?.tmdb_id) return;

    const fetchRecommendations = async () => {
      try {
        const isMovie = item.type === "film";

        const endpoint = isMovie
          ? `https://api.themoviedb.org/3/movie/${item.tmdb_id}/recommendations`
          : `https://api.themoviedb.org/3/tv/${item.tmdb_id}/recommendations`;

        const res = await fetch(
          `${endpoint}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=fr-FR&page=1`,
        );

        const data = await res.json();

        let recommendations = data.results || [];

        // Filtre supplémentaire pour les animes
        if (item.type === "anime") {
          recommendations = recommendations.filter(
            (r: any) => r.genre_ids?.includes(16), // Animation
          );
        }

        setSimilarTitles(recommendations.slice(0, 6));
      } catch (err) {
        console.error("Erreur recommandations TMDB:", err);
      }
    };

    fetchRecommendations();
  }, [item]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
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
          >
            <Dialog.Panel className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#121212] border border-white/5 shadow-2xl custom-scrollbar">
              {/* --- HEADER / HERO --- */}
              <div className="relative w-full aspect-21/9 md:aspect-3/1 overflow-hidden">
                {/* Backdrop Image */}
                <Image
                  src={item.backdrop_url || "/placeholder.svg"}
                  alt=""
                  fill
                  className="object-cover object-top opacity-40 blur-[1px]"
                />
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-[#121212] via-transparent to-transparent" />

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/20 text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                {/* Title & Poster Overlay */}
                <div className="absolute inset-0 flex items-center px-8 gap-6">
                  <div className="relative w-24 md:w-32 aspect-2/3 rounded-lg overflow-hidden shadow-2xl border border-white/10 shrink-0">
                    <Image
                      src={item.poster_url || "/placeholder.svg"}
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <h2 className="text-3xl md:text-4xl w-[50%] font-bold text-white tracking-tight uppercase">
                    {item.title}
                  </h2>
                </div>
              </div>

              {/* --- METADATA ROW --- */}
              <div className="px-8 py-4 flex flex-wrap items-center gap-6 text-zinc-400 text-sm font-medium border-b border-white/5">
                <div className="flex items-center gap-1.5 text-white">
                  <Star size={18} className="text-amber-400 fill-amber-400" />
                  <span className="text-lg font-bold">
                    {item.user_rating || "9.1"}
                  </span>
                </div>
                <span>{item.year}</span>
                <span>{item.type}</span>

                <div className="ml-auto w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-500">
                  <Info size={14} />
                </div>
              </div>

              {/* --- ACTION BUTTONS --- */}
              <div className="px-8 py-6 flex flex-wrap gap-3">
                {/* WATCHED */}
                <button
                  disabled={watched}
                  onClick={() => {
                    if (!watched) {
                      setWatched(true);
                      setInWatchlist(false);
                    }
                  }}
                  className={cn(
                    "h-10 px-6 rounded-full font-bold text-xs uppercase tracking-wider transition-all",
                    watched
                      ? "bg-green-600 text-white cursor-default"
                      : "bg-white text-black hover:bg-zinc-200",
                  )}
                >
                  {watched ? "Watched" : "Mark as Watched"}
                </button>

                {/* FAVORITE */}
                <button
                  onClick={() => setFavorite(!favorite)}
                  className="h-10 px-6 rounded-full border border-zinc-700 text-white text-xs font-bold flex items-center gap-2 hover:bg-white/5 transition-all"
                >
                  <Heart
                    size={16}
                    className={cn(
                      "transition-all",
                      favorite && "fill-current text-red-500",
                    )}
                  />
                  {favorite ? "Favorited" : "Add to Favorites"}
                </button>

                {/* WATCHLIST (hidden if watched) */}
                {!watched && (
                  <button
                    onClick={() => setInWatchlist(!inWatchlist)}
                    className="h-10 px-6 rounded-full border border-zinc-700 text-white text-xs font-bold flex items-center gap-2 hover:bg-white/5 transition-all"
                  >
                    <Plus size={16} />
                    {inWatchlist ? "In Watchlist" : "Add to Watchlist"}
                  </button>
                )}

                {/* TRAILER */}
                <button className="h-10 px-6 rounded-full border border-zinc-700 text-white text-xs font-bold flex items-center gap-2 hover:bg-white/5 transition-all">
                  <Play size={16} className="fill-current" />
                  Play Trailer
                </button>
              </div>

              {/* --- CONTENT GRID --- */}
              <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/5">
                {/* Left Column */}
                <div className="md:col-span-2 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-white font-bold text-lg">Overview</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">
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
                    {/* Directors */}
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

                    {/* Studio */}
                    {item.studio && (
                      <div className="text-sm">
                        <span className="text-zinc-500">Studio:</span>{" "}
                        <span className="text-zinc-300">{item.studio}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
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
                  </div>
                </div>
              </div>

              {/* --- SIMILAR TITLES --- */}
              <div className="px-8 py-8 border-t border-white/5 space-y-6">
                <h3 className="text-white font-bold text-lg">Similar Titles</h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {similarTitles.map((sim) => (
                    <div
                      key={sim.id}
                      className="group cursor-pointer space-y-3"
                    >
                      {/* Poster vertical */}
                      <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                        <Image
                          src={
                            sim.poster_path
                              ? `https://image.tmdb.org/t/p/w500${sim.poster_path}`
                              : "/placeholder.svg"
                          }
                          alt={sim.title || sim.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      {/* Titre */}
                      <p className="text-sm font-medium text-zinc-300 line-clamp-2 group-hover:text-white transition-colors">
                        {sim.title || sim.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* --- FOOTER / SAVE --- */}
              <div className="px-8 py-6 bg-black/20 border-t border-white/5 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-8 h-10 bg-zinc-100 text-black rounded-full font-bold text-xs uppercase tracking-widest hover:bg-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
