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

export function normalizeVolume(volume: GoogleBooksVolume): BookSearchResult {
  const info = volume.volumeInfo;
  const rawYear = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : null;

  return {
    external_id:  volume.id,
    title:        info.title,
    author:       info.authors?.[0] ?? null,
    cover_url: (() => {
      const img = info.imageLinks;
      const raw = img?.thumbnail ?? img?.smallThumbnail ?? null;
      if (!raw) return null;
      try {
        const url = new URL(raw.replace("http:", "https:"));
        url.searchParams.set("zoom", "5");
        url.searchParams.delete("edge");
        url.searchParams.set("fife", "w400");
        return url.toString();
      } catch {
        return raw.replace("http:", "https:");
      }
    })(),
    year:        rawYear && !isNaN(rawYear) ? rawYear : null,
    genre:       info.categories ?? [],
    total_pages: info.pageCount ?? null,
    description: info.description ?? null,
  };
}
