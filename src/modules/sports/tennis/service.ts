/* eslint-disable @typescript-eslint/no-explicit-any */

import { cache } from "react";
import { createServerClient } from "@/infrastructure/supabase/server";
import type { TennisPlayers, TennisPlayer } from "./types";

// =====================================================
// TENNIS SERVICE
// =====================================================

export const getTennisPlayers = cache(async (userId: string): Promise<TennisPlayers> => {
  const supabase = await createServerClient();

  // Run favorites + settings in parallel
  const [{ data: favorites }, { data: settings }] = await Promise.all([
    supabase.schema("sport").from("user_favorites")
      .select("entity_id").eq("user_id", userId).eq("entity_type", "tennis_player"),
    supabase.schema("sport").from("tennis_user_settings")
      .select("main_player_id").eq("user_id", userId).maybeSingle(),
  ]);

  const favoritePlayerIds = favorites?.map((f: any) => f.entity_id) ?? [];
  const mainPlayerId = settings?.main_player_id ?? null;

  let favoritePlayers: TennisPlayer[] = [];
  if (favoritePlayerIds.length) {
    const { data } = await supabase
      .schema("sport").from("tennis_players")
      .select("id, name, country, photo_thumb_url, photo_cutout_url")
      .in("id", favoritePlayerIds);

    favoritePlayers = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      photo_url: p.photo_thumb_url ?? p.photo_cutout_url ?? null,
    }));
  }

  return { favoritePlayers, favoritePlayerIds, mainPlayerId };
});