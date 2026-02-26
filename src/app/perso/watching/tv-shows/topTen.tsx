/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { MediaCarousel } from "@/components/watching/MediaCarousel";
import { supabase } from "@/lib/supabase";
import type { WatchItem } from "@/lib/watching-data";

type TopTenBaseProps = {
  variant: "tv" | "anime";
  onAddClick?: () => void;
  refreshTrigger: number;
};

export default function TopTenBase({
  variant,
  onAddClick,
  refreshTrigger,
}: TopTenBaseProps) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopTen = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setError("Non connecté");
          return;
        }

        // 🔥 mapping type dynamique
        const mediaType = variant === "tv" ? "serie" : "anime";

        const { data, error: fetchError } = await supabase
          .from("media_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", mediaType)
          .not("user_rating", "is", null)
          .not("priority", "is", null)
          .order("user_rating", { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        setItems(data || []);
      } catch (err: any) {
        console.error("Erreur Top 10:", err);
        setError("Impossible de charger le Top 10");
      } finally {
        setLoading(false);
      }
    };

    fetchTopTen();
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

  const title = variant === "tv" ? "My Top 10 TV Shows" : "My Top 10 Anime";

  const subtitle =
    variant === "tv"
      ? "Your highest rated TV shows"
      : "Your highest rated anime";

  return (
    <MediaCarousel
      title={title}
      subtitle={subtitle}
      items={items}
      onAddClick={onAddClick}
      addCardPosition="end"
    />
  );
}
