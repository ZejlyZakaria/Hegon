/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/scorers/[code]/route.ts
//
// Top scorers of a competition (Golden Boot race). Read-only passthrough — the football-data key
// lives on the server; the client hits this route and TanStack Query caches the result. No DB table:
// scorers are only shown on the (infrequently opened) Competition page, so an on-demand fetch with a
// client-side staleTime is enough and stays well under 10 req/min.
// `code` is the football-data competition code (PD, PL, CL…) or numeric id.

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

  if (!FD_KEY) {
    return NextResponse.json({ scorers: [] });
  }

  const res = await fetch(`${FD_BASE}/competitions/${code}/scorers?limit=20`, {
    headers: { "X-Auth-Token": FD_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: res.status });
  }
  const data = await res.json();

  const scorers = ((data?.scorers ?? []) as any[]).map((s, i) => ({
    rank: i + 1,
    player_name: s.player?.name ?? "",
    team_name: s.team?.name ?? "",
    team_crest: s.team?.crest ?? null,
    goals: s.goals ?? 0,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
    played_matches: s.playedMatches ?? null,
  }));

  return NextResponse.json({ scorers });
}
