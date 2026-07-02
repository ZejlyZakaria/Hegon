// app/api/omdb/route.ts — proxy so the OMDb key stays server-side.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { tmdbRatelimit } from "@/shared/lib/ratelimit";

const OMDB_BASE = "https://www.omdbapi.com/";
const OMDB_KEY = process.env.OMDB_API_KEY;
const IMDB_ID = /^tt\d+$/;

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  // Local JWT verification (same pattern as /api/tmdb — see CLAUDE.md §8).
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { success } = await tmdbRatelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!OMDB_KEY) {
    return NextResponse.json({ error: "OMDb key not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const imdbId = searchParams.get("i");
  const season = searchParams.get("Season");

  if (!imdbId || !IMDB_ID.test(imdbId)) {
    return NextResponse.json({ error: "Invalid imdb id" }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set("apikey", OMDB_KEY);
  params.set("i", imdbId);
  // Season is used later for the per-episode heatmap.
  if (season && /^\d+$/.test(season)) params.set("Season", season);

  try {
    const res = await fetch(`${OMDB_BASE}?${params.toString()}`, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json({ error: `OMDb error: ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch OMDb" }, { status: 500 });
  }
}
