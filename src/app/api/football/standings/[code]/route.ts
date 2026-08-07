/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/standings/[code]/route.ts
//
// Live league table for the Competition page. Read-only passthrough of /competitions/{code}/standings
// (TOTAL table). No DB dependency on the standings sync → always fresh, ~20 rows. Key stays server-side.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";

const FD_BASE = "https://api.football-data.org/v4";
const FD_KEY = process.env.FOOTBALL_DATA_KEY;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\w+$/.test(code)) {
    return NextResponse.json({ error: "Invalid competition code" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FD_KEY) return NextResponse.json({ standings: [] });

  const res = await fetch(`${FD_BASE}/competitions/${code}/standings`, {
    headers: { "X-Auth-Token": FD_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: res.status });
  }
  const d = await res.json();

  const all: any[] = d.standings ?? [];
  const total = all.find((s) => s.type === "TOTAL") ?? all[0];
  const standings = ((total?.table ?? []) as any[]).map((r) => ({
    position: r.position ?? 0,
    team_name: r.team?.name ?? "",
    team_crest: r.team?.crest ?? null,
    team_external_id: String(r.team?.id ?? ""),
    played: r.playedGames ?? 0,
    won: r.won ?? 0,
    draw: r.draw ?? 0,
    lost: r.lost ?? 0,
    goal_difference: r.goalDifference ?? 0,
    points: r.points ?? 0,
  }));

  return NextResponse.json({ standings });
}
