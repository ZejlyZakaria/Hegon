// app/api/tmdb/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { tmdbRatelimit } from "@/shared/lib/ratelimit";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.TMDB_API_KEY;

// Allowlist of TMDB endpoint patterns used by the app
const ALLOWED_ENDPOINT = /^[a-z\d_/\-]+$/i;

/**
 * ASK FOR ONLY WHAT WE USE — and when the API won't let us, drop the rest before it crosses the wire.
 *
 * `watch/providers` answers with EVERY country on earth: 29 KB on House of the Dragon, of which the
 * app reads exactly one region. TMDB has no region filter on that endpoint, so the trim has to
 * happen here, on the server, where the bytes are still ours to discard.
 *
 * ⚠️ NOT a blind filter. The client resolves a preferred region and then falls back to "any region
 * that has something", so cutting to four countries would silently blank out a title that only
 * streams elsewhere — a smaller payload and a wrong answer. We keep the requested regions PLUS the
 * first other region that actually carries a flatrate: identical result, a fraction of the size.
 *
 * The caller declares the regions it will read (`providerRegions`), so this stays a contract rather
 * than a hidden assumption about who consumes the response.
 */
function trimProviderRegions(block: unknown, want: string[]): unknown {
  const b = block as { results?: Record<string, { flatrate?: unknown[] }> } | null;
  const results = b?.results;
  if (!results) return block;

  const kept: Record<string, unknown> = {};
  for (const region of want) if (results[region]) kept[region] = results[region];

  if (!want.some((r) => results[r]?.flatrate?.length)) {
    const fallback = Object.keys(results).find((r) => results[r]?.flatrate?.length);
    if (fallback) kept[fallback] = results[fallback];
  }
  return { ...b, results: kept };
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  // Local JWT verification via getClaims() (asymmetric keys → no network round-trip;
  // falls back to getUser() otherwise). Same perf fix as middleware — see CLAUDE.md §8.
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

  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB key not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const endpoint = searchParams.get("endpoint");

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  if (!ALLOWED_ENDPOINT.test(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  // Regions the caller will actually read. Ours, not TMDB's — so it must not be forwarded.
  const providerRegions = searchParams.get("providerRegions");

  const params = new URLSearchParams();
  params.set("api_key", TMDB_KEY);
  searchParams.forEach((value, key) => {
    if (key !== "endpoint" && key !== "providerRegions") params.set(key, value);
  });
  // App is English-only — force EN on every TMDB call (kills the FR→EN flash
  // and stops FR titles/overviews being stored or shown).
  params.set("language", "en-US");

  const url = `${TMDB_BASE}/${endpoint}?${params.toString()}`;

  /**
   * A SEASON IS LIVE DATA — DO NOT SERVE IT FROM A SNAPSHOT.
   *
   * The Data Cache is stale-while-revalidate: an expired entry is served ONE more time while it
   * regenerates in the background. Fine for a film's details. Wrong for `season/N`: TMDB fills a
   * season over days AFTER it airs (stills, synopses, even titles arrive late), so a snapshot taken
   * before release is a list of "Episode 1 · 3 Sept" placeholders — and that is exactly what the
   * season panel showed on its first open after a release (The Gentlemen S2, Bleach S2 on
   * 2026-09-14), with the real data only on the refresh. Same cache, same fault in production.
   *
   * So the season endpoint skips the server cache entirely. The client still holds it for 30
   * minutes (useSeasonEpisodes), which is what shields the TMDB quota; the server no longer holds a
   * photo it cannot know is stale.
   */
  const live = /\/season\/\d+$/.test(endpoint);

  try {
    const res = await fetch(url, live ? { cache: "no-store" } : { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ error: `TMDB error: ${res.status}` }, { status: res.status });
    }
    const data = await res.json();

    if (providerRegions) {
      const want = providerRegions.split(",").filter(Boolean);
      // Appended onto a title record (the fiche bundle), or fetched on its own.
      if (data?.["watch/providers"]) {
        data["watch/providers"] = trimProviderRegions(data["watch/providers"], want);
      } else if (endpoint.endsWith("/watch/providers")) {
        return NextResponse.json(trimProviderRegions(data, want));
      }
    }

    // Says which branch answered — readable in DevTools, in prod too, so "is this a snapshot?"
    // has an answer that isn't a guess.
    return NextResponse.json(data, { headers: { "x-tmdb-cache": live ? "no-store" : "revalidate-3600" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch TMDB" }, { status: 500 });
  }
}