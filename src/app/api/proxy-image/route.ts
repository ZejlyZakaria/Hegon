import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";

const ALLOWED_HOSTS = [
  "image.tmdb.org",
  "femvhonlpafdajyamvcu.supabase.co",
];
// AniList serves cour posters from subdomains (s4.anilist.co, img.anilist.co). A single anime
// season's own artwork lives there, so without this the Year Wrapped poster fan rendered it blank.
// Suffix match with the leading dot → a subdomain of anilist.co only, never `evilanilist.co`.
const ALLOWED_HOST_SUFFIXES = [".anilist.co"];

export async function GET(req: NextRequest) {
  // The host allowlist stops SSRF, but not abuse: without this anyone could push bandwidth through
  // the server. The one caller (Stats → WrappedCard) is behind the auth middleware, so a signed-in
  // check costs it nothing. Local JWT verification, same as the other API routes — see CLAUDE.md §8.
  const supabase = await createServerClient();
  // Reverted getClaims() → getUser() (2026-07-29 prod-outage hotfix — see middleware.ts).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  const hostAllowed =
    ALLOWED_HOSTS.includes(parsed.hostname) ||
    ALLOWED_HOST_SUFFIXES.some((suffix) => parsed.hostname.endsWith(suffix));
  if (!hostAllowed) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new NextResponse("Upstream error", { status: 502 });

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
