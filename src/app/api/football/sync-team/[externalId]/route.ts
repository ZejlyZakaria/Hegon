/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/sync-team/[externalId]/route.ts
//
// Bulk cache-fill for ONE team's whole current-season calendar into sport.football_matches.
// Called SERVER-SIDE right after a team is followed (immediate populate) and by the refresh cron —
// a single football-data call returns the full calendar (~38 matches), finished + scheduled.
// The client never sees the key; reads always come from the DB afterward. Same admin/upsert pattern
// and row mapping as /api/football/match/[id], but batched over the whole list.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { createClient } from "@supabase/supabase-js";

const FD_BASE = "https://api.football-data.org/v4";
const FD_KEY = process.env.FOOTBALL_DATA_KEY;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "sport" } },
  );
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ externalId: string }> }) {
  const { externalId } = await params;
  if (!/^\d+$/.test(externalId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  // Auth — local JWT verification (getClaims), same as the other football/tmdb routes.
  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FD_KEY) {
    return NextResponse.json({ error: "Football data key not configured" }, { status: 500 });
  }

  // The whole current-season calendar for this team (finished + scheduled) in one call.
  const res = await fetch(`${FD_BASE}/teams/${externalId}/matches`, {
    headers: { "X-Auth-Token": FD_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: res.status });
  }
  const data = await res.json();
  const matches: any[] = data?.matches ?? [];
  if (!matches.length) return NextResponse.json({ synced: 0 });

  const db = adminClient();

  // Resolve competition + team UUIDs ONCE (batched) — no per-match DB round-trips.
  const compExtIds = [...new Set(matches.map((m) => String(m.competition?.id)).filter((v) => v && v !== "undefined"))];
  const teamExtIds = [...new Set(matches.flatMap((m) => [String(m.homeTeam?.id), String(m.awayTeam?.id)]).filter((v) => v && v !== "undefined"))];
  const [{ data: comps }, { data: teams }] = await Promise.all([
    db.from("football_competitions").select("id, api_external_id").in("api_external_id", compExtIds),
    db.from("football_teams").select("id, api_external_id").in("api_external_id", teamExtIds),
  ]);
  const compId = new Map((comps as any[] ?? []).map((c) => [c.api_external_id, c.id]));
  const teamId = new Map((teams as any[] ?? []).map((t) => [t.api_external_id, t.id]));

  const now = new Date().toISOString();
  const rows = matches.map((m) => ({
    external_match_id: m.id,
    competition_id: compId.get(String(m.competition?.id)) ?? null,
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
    home_team_id: teamId.get(String(m.homeTeam?.id)) ?? null,
    away_team_id: teamId.get(String(m.awayTeam?.id)) ?? null,
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    home_score_ht: m.score?.halfTime?.home ?? null,
    away_score_ht: m.score?.halfTime?.away ?? null,
    winner: m.score?.winner ?? null,
    last_updated: m.lastUpdated ?? null,
    fetched_at: now,
  }));

  const { error } = await db
    .from("football_matches")
    .upsert(rows, { onConflict: "external_match_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: rows.length });
}
