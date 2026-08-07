/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/football/competition/[code]/route.ts
//
// Season + progress for the Competition page header. Read-only passthrough of /competitions/{code}
// (currentSeason + the seasons list, used to derive total matchdays). Key stays server-side; the
// client caches it. `code` = football-data competition code (PD, PL, CL…) or numeric id.

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

  if (!FD_KEY) return NextResponse.json({ season: null });

  const res = await fetch(`${FD_BASE}/competitions/${code}`, {
    headers: { "X-Auth-Token": FD_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: `football-data ${res.status}` }, { status: res.status });
  }
  const d = await res.json();

  const cs = d.currentSeason ?? {};
  const seasons: any[] = d.seasons ?? [];
  const now = Date.now();

  // Total matchdays = the max matchday reached by a FINISHED season (leagues: 38 / 34…). Fallback to
  // the current season's matchday, else 38.
  const finishedMax = seasons
    .filter((s) => s.endDate && new Date(s.endDate).getTime() < now)
    .reduce((m, s) => Math.max(m, s.currentMatchday || 0), 0);
  const totalMatchdays = finishedMax || cs.currentMatchday || 38;

  const startY = cs.startDate ? String(cs.startDate).slice(0, 4) : null;
  const endY = cs.endDate ? String(cs.endDate).slice(0, 4) : null;
  const label = startY && endY ? (startY === endY ? startY : `${startY}/${endY}`) : (startY ?? "");

  const currentMatchday = cs.currentMatchday ?? 0;
  const started = cs.startDate ? new Date(cs.startDate).getTime() <= now : false;
  const progress = !started ? 0 : Math.min(1, totalMatchdays ? currentMatchday / totalMatchdays : 0);

  return NextResponse.json({
    season: { start: cs.startDate ?? null, end: cs.endDate ?? null, label, currentMatchday, totalMatchdays, progress, started },
  });
}
