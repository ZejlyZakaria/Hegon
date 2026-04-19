/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentUserId } from "@/shared/utils/getCurrentUserId";
import type { TennisPlayers, TennisPlayer } from "./types";

// =====================================================
// TENNIS SERVICE
// =====================================================

export async function getTennisPlayers(userId: string): Promise<TennisPlayers> {
  const supabase = createClient();

  const { data: favorites } = await supabase.schema("sport").from("user_favorites")
    .select("entity_id").eq("user_id", userId).eq("entity_type", "tennis_player");

  const favoritePlayerIds = favorites?.map((f: any) => f.entity_id) ?? [];
  const mainPlayerId = favoritePlayerIds[0] ?? null;

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
}

// ─── Master page data ─────────────────────────────────────────────────────────

export async function getTennisPageData(): Promise<any> {
  const supabase = createClient();

  // Step 1: get userId once
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const now = new Date().toISOString();

  // Step 2: user prefs + players (settings+favorites parallel, then player details)
  const players = await getTennisPlayers(userId);
  const { favoritePlayers, favoritePlayerIds, mainPlayerId } = players;

  // Step 3: all data in parallel — including the tournament fetch
  const [
    rankingsRes,
    nextMatchesRes,
    tournamentRes,
    recentMatchesRes,
    atpRankingsRes,
  ] = await Promise.all([
    favoritePlayerIds.length
      ? supabase.schema("sport").from("tennis_rankings")
          .select("player_id, rank")
          .in("player_id", favoritePlayerIds)
      : Promise.resolve({ data: [] }),
    favoritePlayerIds.length
      ? supabase.schema("sport").from("tennis_matches")
          .select("player_id, tournament_id, match_date, opponent_name, round, tennis_tournaments(name, surface)")
          .in("player_id", favoritePlayerIds)
          .eq("status", "scheduled")
          .gte("match_date", now)
          .order("match_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.schema("sport").from("tennis_tournaments")
      .select("id, name, surface, start_date, end_date, country, level")
      .or(`start_date.gt.${now},and(start_date.lte.${now},end_date.gte.${now})`)
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    favoritePlayerIds.length
      ? supabase.schema("sport").from("tennis_matches")
          .select("id, player_id, opponent_name, opponent_cache_id, match_date, score, winner, round, tennis_players_cache(photo_thumb_url, photo_cutout_url), tennis_tournaments(name)")
          .in("player_id", favoritePlayerIds)
          .eq("status", "finished")
          .order("match_date", { ascending: false })
          .limit(favoritePlayerIds.length * 3)
      : Promise.resolve({ data: [] }),
    supabase.schema("sport").from("tennis_rankings")
      .select("player_id, rank, points, tennis_players(id, name, country, photo_thumb_url, photo_cutout_url)")
      .order("rank", { ascending: true })
      .limit(25),
  ]);

  // Build shared rankings map
  const rankingsMap: Record<string, number> = {};
  for (const r of rankingsRes.data ?? []) {
    rankingsMap[r.player_id] = r.rank;
  }

  // Hero: next match per player
  const nextMatchByPlayer: Record<string, any> = {};
  for (const m of nextMatchesRes.data ?? []) {
    if (!nextMatchByPlayer[m.player_id]) nextMatchByPlayer[m.player_id] = m;
  }

  const playerHeroes = favoritePlayers
    .map((player: any) => ({
      player: {
        id: player.id,
        name: player.name,
        country: player.country ?? null,
        photo_url: player.photo_url ?? null,
      },
      rank: rankingsMap[player.id] ?? null,
      isMainPlayer: player.id === mainPlayerId,
      nextMatch: nextMatchByPlayer[player.id] ?? null,
    }))
    .sort((a: any, b: any) => {
      if (a.isMainPlayer !== b.isMainPlayer) return b.isMainPlayer ? 1 : -1;
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });

  // Tournament section — conditional Step 4 (only if tournament found)
  const tournament = tournamentRes.data ?? null;
  const playersInTournament: any[] = [];

  if (tournament && favoritePlayerIds.length) {
    const { data: matchesInTournament } = await supabase
      .schema("sport")
      .from("tennis_matches")
      .select("player_id, tournament_id, match_date, opponent_name, round")
      .in("player_id", favoritePlayerIds)
      .eq("tournament_id", tournament.id)
      .eq("status", "scheduled")
      .gt("match_date", now)
      .order("match_date", { ascending: true });

    const matchByPlayer: Record<string, any> = {};
    for (const m of matchesInTournament ?? []) {
      if (!matchByPlayer[m.player_id]) matchByPlayer[m.player_id] = m;
    }

    const processedDuelKeys = new Set<string>();

    for (const p of favoritePlayers as any[]) {
      const match = matchByPlayer[p.id];
      if (!match) continue;

      const opponentFavorite = (favoritePlayers as any[]).find(
        (fp: any) => fp.id !== p.id && matchByPlayer[fp.id]?.match_date === match.match_date
      );

      if (opponentFavorite) {
        const duelKey = [p.id, opponentFavorite.id].sort().join(":");
        if (processedDuelKeys.has(duelKey)) continue;
        processedDuelKeys.add(duelKey);

        const rankA = rankingsMap[p.id] ?? 9999;
        const rankB = rankingsMap[opponentFavorite.id] ?? 9999;
        const primary = rankA <= rankB ? p : opponentFavorite;
        const secondary = rankA <= rankB ? opponentFavorite : p;

        playersInTournament.push({
          player: { id: primary.id, name: primary.name, photo_url: primary.photo_url ?? null, country: primary.country ?? null },
          rank: rankingsMap[primary.id] ?? null,
          nextMatch: { match_date: match.match_date, opponent_name: secondary.name, opponent_photo_url: secondary.photo_url ?? null, round: match.round ?? null },
        });
      } else {
        playersInTournament.push({
          player: { id: p.id, name: p.name, photo_url: p.photo_url ?? null, country: p.country ?? null },
          rank: rankingsMap[p.id] ?? null,
          nextMatch: { match_date: match.match_date, opponent_name: match.opponent_name ?? null, opponent_photo_url: null, round: match.round ?? null },
        });
      }
    }
  }

  const isOngoing = tournament
    ? tournament.start_date <= now && (!tournament.end_date || tournament.end_date >= now)
    : false;

  // Recent matches
  const recentMatches = (recentMatchesRes.data ?? []).map((m: any) => {
    const opponentPhotoUrl = m.tennis_players_cache?.photo_cutout_url ?? m.tennis_players_cache?.photo_thumb_url ?? null;
    return {
      id: m.id,
      player_id: m.player_id,
      opponent_name: m.opponent_name,
      opponent_photo_url: opponentPhotoUrl,
      match_date: m.match_date,
      score: m.score,
      result: m.winner === "player" ? "W" : "L",
      round: m.round,
      tournament_name: m.tennis_tournaments?.name ?? null,
    };
  });

  const followedPlayers = favoritePlayers.map((p: any) => ({
    id: p.id,
    name: p.name,
    photo_url: p.photo_url ?? null,
    isMainPlayer: p.id === mainPlayerId,
  }));

  // ATP rankings
  const rankings = (atpRankingsRes.data ?? []).map((r: any) => {
    const player = Array.isArray(r.tennis_players) ? r.tennis_players[0] : r.tennis_players;
    return {
      player_id: r.player_id,
      rank: r.rank,
      ranking_points: r.points ?? null,
      tennis_players: player
        ? { id: player.id, name: player.name, country: player.country ?? null, photo_url: player.photo_cutout_url ?? player.photo_thumb_url ?? null }
        : null,
    };
  });

  return {
    userId,
    playerHeroes,
    favoritePlayerIds,
    mainPlayerId,
    tournament,
    isOngoing,
    playersInTournament,
    recentMatches,
    followedPlayers,
    rankings,
  };
}
