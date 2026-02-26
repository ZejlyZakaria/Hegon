/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { MediaCarousel } from "@/components/watching/MediaCarousel";
import { supabase } from "@/lib/supabase";
import type { WatchItem } from "@/lib/watching-data";

type TopTenProps = {
  onAddClick?: () => void;
  refreshTrigger: number;
};

export default function TopTen({ onAddClick, refreshTrigger }: TopTenProps) {
  const [topRated, setTopRated] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fonction de refresh (appelée après ajout modal)
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

        const { data, error: fetchError } = await supabase
          .from("media_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "film")
          .not("user_rating", "is", null)
          .not("priority", "is", null)
          .order("user_rating", { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        setTopRated(data || []);
      } catch (err: any) {
        console.error("Erreur Top 10:", err);
        setError("Impossible de charger le Top 10");
      } finally {
        setLoading(false);
      }
    };

    fetchTopTen();
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
      title="My Top 10 of All Time"
      subtitle="Your highest rated across all categories"
      items={topRated}
      onAddClick={onAddClick}
      addCardPosition="end"
    />
  );
}
