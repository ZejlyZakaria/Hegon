import type { GoogleBooksVolume, BookSearchResult } from "../types";

export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computeStreak(dateSet: Set<string>): { current: number; best: number } {
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  const startOffset = dateSet.has(todayStr) ? 0 : dateSet.has(yesterdayStr) ? 1 : -1;

  let current = 0;
  if (startOffset >= 0) {
    for (let i = startOffset; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (dateSet.has(toLocalDateStr(d))) {
        current++;
      } else {
        break;
      }
    }
  }

  let best = 0;
  let consecutive = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (dateSet.has(toLocalDateStr(d))) {
      consecutive++;
      best = Math.max(best, consecutive);
    } else {
      consecutive = 0;
    }
  }

  return { current, best };
}

// Prefer ISBN-13, then ISBN-10 — the key to a high-res Open Library cover.
function pickIsbn(ids?: { type: string; identifier: string }[]): string | null {
  if (!ids?.length) return null;
  return (
    ids.find((i) => i.type === "ISBN_13")?.identifier ??
    ids.find((i) => i.type === "ISBN_10")?.identifier ??
    null
  );
}

// Google's thumbnail upscaled looks blurry — keep it as a FALLBACK only, and
// don't over-zoom (zoom=1 = the real thumbnail, not a stretched zoom=5).
function googleCover(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.replace("http:", "https:"));
    url.searchParams.delete("edge");
    url.searchParams.set("zoom", "1");
    url.searchParams.set("fife", "w400");
    return url.toString();
  } catch {
    return raw.replace("http:", "https:");
  }
}

export function normalizeVolume(volume: GoogleBooksVolume): BookSearchResult {
  const info = volume.volumeInfo;
  const rawYear = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null;

  // Cover candidates, best first: Open Library hi-res (by ISBN, ?default=false
  // → 404 if none so the UI falls through) → cleaned Google thumbnail.
  const isbn = pickIsbn(info.industryIdentifiers);
  const ol = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;
  const google = googleCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail);
  const cover_candidates = [ol, google].filter((x): x is string => !!x);

  return {
    external_id:      volume.id,
    title:            info.title,
    author:           info.authors?.[0] ?? null,
    cover_url:        cover_candidates[0] ?? null,
    cover_candidates,
    year:             rawYear && !isNaN(rawYear) ? rawYear : null,
    genre:            info.categories ?? [],
    total_pages:      info.pageCount ?? null,
    description:      info.description ?? null,
  };
}
