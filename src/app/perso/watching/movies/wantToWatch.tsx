/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MediaCarousel } from "@/components/watching/MediaCarousel";
import type { WatchItem } from "@/lib/watching-data";

type WantToWatchProps = {
  onAddClick?: () => void;
  refreshTrigger: number;
};

export default function WantToWatch({
  onAddClick,
  refreshTrigger,
}: WantToWatchProps) {
  const [wantToWatch, setWantToWatch] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWantToWatchProps = async () => {
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
          .eq("want_to_watch", true)
          .eq("watched", false)
          .eq("type", "film")
          .is("watched_at", null)
          .order("priority", { ascending: true })
          .limit(10);

        if (fetchError) throw fetchError;

        setWantToWatch(data || []);
      } catch (err: any) {
        console.error("Erreur Top 10:", err);
        setError("Impossible de charger les films que tu veux regarder");
      } finally {
        setLoading(false);
      }
    };

    fetchWantToWatchProps();
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
      title="À voir"
      subtitle="Tes films à voir bientôt"
      items={wantToWatch}
      onAddClick={onAddClick}
      addCardPosition="start"
    />
  );
}
