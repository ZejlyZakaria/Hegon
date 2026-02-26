"use client";

import { useState, useEffect, useMemo } from "react";
import LibraryFilters from "@/components/watching/LibraryFilters";
import LibraryGrid from "@/components/watching/LibraryGrid";
import { supabase } from "@/lib/supabase";
import type { WatchItem } from "@/lib/watching-data";

const ITEMS_PER_PAGE = 24;

export default function LibraryPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [mediaType, setMediaType] = useState<
    "all" | "film" | "serie" | "anime"
  >("all");
  const [sortBy, setSortBy] = useState<
    "added" | "rating" | "title" | "year" | "favorite"
  >("added");

  // Fetch
  useEffect(() => {
    const fetchLibrary = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("media_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("watched", true)
        .order("watched_at", { ascending: false });

      setItems(data || []);
      setLoading(false);
    };

    fetchLibrary();
  }, []);

  // Filtrage + Tri + Pagination
  const { paginatedItems, totalPages } = useMemo(() => {
    let result = [...items];

    // 1. Filtre par type
    if (mediaType !== "all") {
      result = result.filter((item) => item.type === mediaType);
    }

    // 2. Si "Favoris" est sélectionné → afficher SEULEMENT les favoris
    if (sortBy === "favorite") {
      result = result.filter((item) => item.favorite === true);
    }

    // 3. Tri (si pas "favoris", on trie normalement ; si "favoris", on trie par autre critère après le filtre)
    result.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.user_rating || 0) - (a.user_rating || 0);
        case "title":
          return a.title.localeCompare(b.title);
        case "year":
          return (b.year || 0) - (a.year || 0);
        default:
          return (
            new Date(b.watched_at || 0).getTime() -
            new Date(a.watched_at || 0).getTime()
          );
      }
    });

    // Pagination
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = result.slice(start, start + ITEMS_PER_PAGE);

    return {
      paginatedItems: paginated,
      totalPages: Math.ceil(result.length / ITEMS_PER_PAGE),
    };
  }, [items, currentPage, mediaType, sortBy]);

  const handleFilterChange = (filters: {
    mediaType: "all" | "film" | "serie" | "anime";
    sortBy: "added" | "rating" | "title" | "year" | "favorite";
  }) => {
    setMediaType(filters.mediaType);
    setSortBy(filters.sortBy);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Filtres skeleton */}
        <div className="flex gap-4">
          <div className="h-8 w-24 bg-zinc-800 rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-zinc-800 rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-zinc-800 rounded-full animate-pulse" />
          <div className="h-8 w-32 bg-zinc-800 rounded-full animate-pulse ml-auto" />
        </div>

        {/* Grid de cartes skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-2/3 bg-zinc-800 rounded-xl animate-pulse" />
              <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <LibraryFilters onFilterChange={handleFilterChange} />

      <LibraryGrid items={paginatedItems} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white/5 rounded-lg disabled:opacity-30"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-sm text-zinc-400">
            Page {currentPage} sur {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white/5 rounded-lg disabled:opacity-30"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
