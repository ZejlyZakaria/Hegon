/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MediaCarousel } from "@/components/watching/MediaCarousel";
import type { WatchItem } from "@/lib/watching-data";

type RecentlyWatchedBaseProps = {
  variant: "tv" | "anime";
  onAddClick?: () => void;
  refreshTrigger: number;
};

export default function RecentlyWatchedBase({
  variant,
  onAddClick,
  refreshTrigger,
}: RecentlyWatchedBaseProps) {
  const [items, setItems] = useState<WatchItem[]>([]);
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

        // 🔥 mapping dynamique
        const mediaType = variant === "tv" ? "serie" : "anime";

        const { data, error: fetchError } = await supabase
          .from("media_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", mediaType)
          .eq("watched", true)
          .not("watched_at", "is", null)
          .order("watched_at", { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        setItems(data || []);
      } catch (err: any) {
        console.error("Erreur Recently Watched:", err);
        setError("Impossible de charger les contenus récemment vus");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentlyWatched();
  }, [refreshTrigger, variant]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        <div className="h-6 w-1/4 bg-zinc-800 rounded animate-pulse" />
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

  const title =
    variant === "tv" ? "Séries vues récemment" : "Animes vus récemment";

  const subtitle =
    variant === "tv"
      ? "Tes derniers épisodes ou séries visionnés"
      : "Tes derniers animes visionnés";

  return (
    <MediaCarousel
      title={title}
      subtitle={subtitle}
      items={items}
      onAddClick={onAddClick}
      addCardPosition="start"
    />
  );
}
