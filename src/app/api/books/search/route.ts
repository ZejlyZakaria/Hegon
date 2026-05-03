import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/infrastructure/supabase/server";
import { normalizeVolume } from "@/modules/books/lib/book-utils";
import type { BookSearchResult } from "@/modules/books/types";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (process.env.NODE_ENV === "production") {
      try {
        const { booksRatelimit } = await import("@/shared/lib/ratelimit");
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const { success } = await booksRatelimit.limit(ip);
        if (!success) {
          return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }
      } catch {
        // Redis unavailable — fail open
      }
    }

    if (!API_KEY) {
      return NextResponse.json({ error: "Books API key not configured" }, { status: 500 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ error: "Query too short" }, { status: 400 });
    }

    const url = `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(q)}&maxResults=10&key=${API_KEY}`;

    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json({ error: `Google Books error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const results: BookSearchResult[] = (data.items ?? []).map(normalizeVolume);
    return NextResponse.json(results);
  } catch (err) {
    console.error("[books/search]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
