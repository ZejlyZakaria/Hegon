/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MediaCarousel } from "@/components/watching/MediaCarousel";
import type { WatchItem } from "@/lib/watching-data";

type RecentlyWatchedProps = {
  onAddClick?: () => void;
  refreshTrigger: number;
};

export default function RecentlyWatched({
  onAddClick,
  refreshTrigger,
}: RecentlyWatchedProps) {
  const [recentlyWatched, setRecentlyWatched] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentlyWatched = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Non connecté");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("media_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("watched", true)
          .eq("type", "film")
          .not("watched_at", "is", null)
          .order("watched_at", { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        setRecentlyWatched(data || []);
      } catch (err: any) {
        console.error("Erreur Top 10:", err);
        setError("Impossible de charger les films vu récement");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentlyWatched();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="h-6 w-1/4 bg-zinc-800 rounded animate-pulse" />{" "}
        {/* Titre skeleton */}
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-[calc(25%-12px)] aspect-video bg-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-400">{error}</div>;
  }

  return (
    <MediaCarousel
      title="Vu récemment"
      subtitle="Tes derniers visionnés"
      items={recentlyWatched}
      onAddClick={onAddClick}
      addCardPosition="start"
    />
  );
}
