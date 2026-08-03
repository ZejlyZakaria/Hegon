/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/match/[id]/route.ts
//
// CACHE-ASIDE for a single match. The football-data key lives on the SERVER only, so the client
// never calls the API directly — it hits this route. Flow: check `sport.football_matches` → a
// FINISHED match is immutable (return it, forever); a fresh non-finished one is good enough; else
// fetch the world's facts from football-data, UPSERT (retention — this table never purges), return.
//
// Writes use the service-role client (RLS on football_matches is select-only), same pattern as the
// tennis routes. Reads/writes are scoped to the `sport` schema.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { createClient } from "@supabase/supabase-js";

const FD_BASE = "https://api.football-data.org/v4";
const FD_KEY = process.env.FOOTBALL_DATA_KEY;

// A FINISHED match never changes → cached forever. Anything else is refreshed after this window
// (scores/status move around kickoff).
const FRESH_MS = 10 * 60 * 1000;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "sport" } },
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const externalId = Number(id);
  if (!Number.isFinite(externalId)) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  // Auth — local JWT verification (getClaims), same as /api/tmdb.
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminClient();

  const { data: cached } = await db
    .from("football_matches")
    .select("*")
    .eq("external_match_id", externalId)
    .maybeSingle();

  if (cached) {
    const fresh = Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS;
    if (cached.status === "FINISHED" || fresh) {
      return NextResponse.json({ match: cached });
    }
  }

  // No key → serve what we have rather than 500 (graceful degradation).
  if (!FD_KEY) {
    if (cached) return NextResponse.json({ match: cached });
    return NextResponse.json({ error: "Football data key not configured" }, { status: 500 });
  }

  const res = await fetch(`${FD_BASE}/matches/${externalId}`, {
    headers: { "X-Auth-Token": FD_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    // Upstream failure (rate-limit, tier gate…) → fall back to the cached row if we have one.
    if (cached) return NextResponse.json({ match: cached });
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: res.status });
  }
  const m = await res.json();

  // Resolve competition + team UUIDs (best-effort; null when not in our reference tables).
  const [{ data: comp }, { data: teams }] = await Promise.all([
    db.from("football_competitions").select("id").eq("api_external_id", String(m.competition?.id)).maybeSingle(),
    db.from("football_teams").select("id, api_external_id").in("api_external_id", [String(m.homeTeam?.id), String(m.awayTeam?.id)]),
  ]);
  const teamId = (ext: string) => (teams as any[])?.find((t) => t.api_external_id === ext)?.id ?? null;

  const row = {
    external_match_id: m.id,
    competition_id: comp?.id ?? null,
    season: m.season?.startDate ? Number(String(m.season.startDate).slice(0, 4)) || null : null,
    utc_date: m.utcDate,
    status: m.status,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    group: m.group ?? null,
    venue: m.venue ?? null,
    attendance: m.attendance ?? null,
    home_team_external_id: String(m.homeTeam?.id),
    away_team_external_id: String(m.awayTeam?.id),
    home_team_name: m.homeTeam?.name ?? "",
    away_team_name: m.awayTeam?.name ?? "",
    home_team_id: teamId(String(m.homeTeam?.id)),
    away_team_id: teamId(String(m.awayTeam?.id)),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    home_score_ht: m.score?.halfTime?.home ?? null,
    away_score_ht: m.score?.halfTime?.away ?? null,
    winner: m.score?.winner ?? null,
    last_updated: m.lastUpdated ?? null,
    fetched_at: new Date().toISOString(),
  };

  const { data: upserted, error } = await db
    .from("football_matches")
    .upsert(row, { onConflict: "external_match_id" })
    .select("*")
    .single();

  if (error) {
    if (cached) return NextResponse.json({ match: cached });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ match: upserted });
}
