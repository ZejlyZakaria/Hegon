import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { tmdbRatelimit } from "@/shared/lib/ratelimit";
import { getAnimeThemes } from "@/modules/watching/anime-themes-server";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const title = request.nextUrl.searchParams.get("title")?.trim();
  const rawYear = request.nextUrl.searchParams.get("year");
  if (!title || title.length > 200 || rawYear != null && (!/^\d{4}$/.test(rawYear) || +rawYear < 1900 || +rawYear > 2200)) {
    return NextResponse.json({ error: "Invalid title or year" }, { status: 400 });
  }
  try {
    const { success } = await tmdbRatelimit.limit(`anime-themes:${data.claims.sub}`);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const groups = await getAnimeThemes(title, rawYear == null ? null : +rawYear);
    return NextResponse.json({ status: "ok", groups }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Optional enrichment failure is not a missing catalogue or a page error.
    return NextResponse.json({ status: "unavailable" }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
