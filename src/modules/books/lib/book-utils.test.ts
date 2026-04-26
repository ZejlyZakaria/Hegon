import { describe, it, expect } from "vitest";
import { toLocalDateStr, computeStreak, normalizeVolume } from "./book-utils";
import type { GoogleBooksVolume } from "../types";

// ── toLocalDateStr ─────────────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("formats a date to YYYY-MM-DD", () => {
    expect(toLocalDateStr(new Date(2026, 3, 26))).toBe("2026-04-26");
  });

  it("pads single-digit month and day", () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles end of year", () => {
    expect(toLocalDateStr(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

// ── computeStreak ──────────────────────────────────────────────────────────

describe("computeStreak", () => {
  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
  }

  it("returns 0/0 for an empty set", () => {
    expect(computeStreak(new Set())).toEqual({ current: 0, best: 0 });
  });

  it("returns current=1 best=1 with only today", () => {
    expect(computeStreak(new Set([daysAgo(0)]))).toEqual({ current: 1, best: 1 });
  });

  it("returns current=1 best=1 with only yesterday", () => {
    expect(computeStreak(new Set([daysAgo(1)]))).toEqual({ current: 1, best: 1 });
  });

  it("counts consecutive days ending today", () => {
    const set = new Set([daysAgo(0), daysAgo(1), daysAgo(2)]);
    expect(computeStreak(set)).toEqual({ current: 3, best: 3 });
  });

  it("counts consecutive days ending yesterday", () => {
    const set = new Set([daysAgo(1), daysAgo(2), daysAgo(3)]);
    expect(computeStreak(set)).toEqual({ current: 3, best: 3 });
  });

  it("returns current=0 when last activity was 2 days ago", () => {
    const set = new Set([daysAgo(2), daysAgo(3)]);
    const result = computeStreak(set);
    expect(result.current).toBe(0);
    expect(result.best).toBe(2);
  });

  it("best streak is the longest run even when current is shorter", () => {
    // 4-day streak from 5-8 days ago, 1-day streak today
    const set = new Set([daysAgo(0), daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8)]);
    const result = computeStreak(set);
    expect(result.current).toBe(1);
    expect(result.best).toBe(4);
  });
});

// ── normalizeVolume ────────────────────────────────────────────────────────

function makeVolume(infoOverrides: Partial<GoogleBooksVolume["volumeInfo"]> = {}): GoogleBooksVolume {
  return {
    id: "abc123",
    volumeInfo: {
      title: "Clean Code",
      authors: ["Robert C. Martin"],
      publishedDate: "2008-08-11",
      pageCount: 464,
      categories: ["Computers"],
      description: "A handbook of agile software craftsmanship",
      imageLinks: {
        thumbnail: "http://books.google.com/books/content?id=abc&zoom=1",
      },
      ...infoOverrides,
    },
  };
}

describe("normalizeVolume", () => {
  it("maps all basic fields correctly", () => {
    const result = normalizeVolume(makeVolume());
    expect(result.external_id).toBe("abc123");
    expect(result.title).toBe("Clean Code");
    expect(result.author).toBe("Robert C. Martin");
    expect(result.year).toBe(2008);
    expect(result.total_pages).toBe(464);
    expect(result.genre).toEqual(["Computers"]);
    expect(result.description).toBe("A handbook of agile software craftsmanship");
  });

  it("uses only the first author", () => {
    const result = normalizeVolume(makeVolume({ authors: ["A", "B", "C"] }));
    expect(result.author).toBe("A");
  });

  it("returns null author when authors is missing", () => {
    const result = normalizeVolume(makeVolume({ authors: undefined }));
    expect(result.author).toBeNull();
  });

  it("returns null cover_url when imageLinks is missing", () => {
    const result = normalizeVolume(makeVolume({ imageLinks: undefined }));
    expect(result.cover_url).toBeNull();
  });

  it("upgrades http to https in cover URL", () => {
    const result = normalizeVolume(makeVolume());
    expect(result.cover_url).toMatch(/^https:/);
  });

  it("injects fife=w400 in cover URL", () => {
    const result = normalizeVolume(makeVolume());
    expect(result.cover_url).toContain("fife=w400");
  });

  it("removes edge param from cover URL", () => {
    const result = normalizeVolume(makeVolume({
      imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc&zoom=1&edge=curl" },
    }));
    expect(result.cover_url).not.toContain("edge=");
  });

  it("returns null year for unparseable publishedDate", () => {
    const result = normalizeVolume(makeVolume({ publishedDate: "unknown" }));
    expect(result.year).toBeNull();
  });

  it("handles publishedDate with year only", () => {
    const result = normalizeVolume(makeVolume({ publishedDate: "2008" }));
    expect(result.year).toBe(2008);
  });

  it("returns empty genre array when categories is missing", () => {
    const result = normalizeVolume(makeVolume({ categories: undefined }));
    expect(result.genre).toEqual([]);
  });

  it("returns null total_pages when pageCount is missing", () => {
    const result = normalizeVolume(makeVolume({ pageCount: undefined }));
    expect(result.total_pages).toBeNull();
  });

  it("returns null description when missing", () => {
    const result = normalizeVolume(makeVolume({ description: undefined }));
    expect(result.description).toBeNull();
  });
});
