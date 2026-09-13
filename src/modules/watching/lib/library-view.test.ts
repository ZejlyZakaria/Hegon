import { describe, expect, it } from "vitest";
import { compareLibrary, matchesStatus, queryLibrary, type LibraryQuery, type LibraryRow } from "./library-view";

// The Library's filter → search → sort → paginate pipeline. Fifty lines of decisions that lived in
// a `useMemo`, invisible to every test until the contre-examen of 2026-09-13 pointed at them.

type Row = LibraryRow & { id: string };
const row = (id: string, over: Partial<Row> = {}): Row => ({
  id, type: "film", title: id, original_title: null, favorite: false, user_rating: null, year: 2000,
  watched_at: null, updated_at: "2026-01-01T00:00:00Z",
  in_progress: false, paused: false, watched: true, dropped: false,
  ...over,
});
const base: LibraryQuery = { type: "all", status: "all", sort: "added", search: "", page: 1, pageSize: 40 };
const ids = (r: { items: Row[] }) => r.items.map((i) => i.id);

const library: Row[] = [
  row("Dune",        { type: "film",  year: 2021, user_rating: 9,   watched_at: "2026-03-01" }),
  row("Andor",       { type: "serie", year: 2022, user_rating: 8.5, watched: false, in_progress: true, updated_at: "2026-04-01" }),
  row("Frieren",     { type: "anime", year: 2023, user_rating: 10,  favorite: true, watched_at: "2026-02-01" }),
  row("Lost",        { type: "serie", year: 2004, user_rating: 6,   watched: false, dropped: true, updated_at: "2025-06-01" }),
  row("The Bear",    { type: "serie", year: 2022, user_rating: null, watched: false, paused: true, updated_at: "2026-01-15" }),
  row("Le Fabuleux", { type: "film",  year: 2001, original_title: "Le Fabuleux Destin d'Amélie Poulain", favorite: true, watched_at: "2024-12-31" }),
];

describe("matchesStatus — one place, so the chips and the grid agree", () => {
  it("maps each chip to exactly one flag", () => {
    expect(matchesStatus(row("a", { in_progress: true }), "watching")).toBe(true);
    expect(matchesStatus(row("a", { paused: true }), "paused")).toBe(true);
    expect(matchesStatus(row("a", { watched: true }), "completed")).toBe(true);
    expect(matchesStatus(row("a", { dropped: true }), "dropped")).toBe(true);
    expect(matchesStatus(row("a", { watched: true }), "watching")).toBe(false);
  });
  it("'all' lets everything through", () => {
    expect(matchesStatus(row("a", { watched: false }), "all")).toBe(true);
  });
});

describe("queryLibrary — filters", () => {
  it("returns everything, newest activity first, with no filters", () => {
    expect(ids(queryLibrary(library, base))).toEqual(["Andor", "Dune", "Frieren", "The Bear", "Lost", "Le Fabuleux"]);
  });
  it("filters by type", () => {
    expect(ids(queryLibrary(library, { ...base, type: "serie" }))).toEqual(["Andor", "The Bear", "Lost"]);
  });
  it("filters by status", () => {
    expect(ids(queryLibrary(library, { ...base, status: "completed" }))).toEqual(["Dune", "Frieren", "Le Fabuleux"]);
    expect(ids(queryLibrary(library, { ...base, status: "dropped" }))).toEqual(["Lost"]);
  });
  it("'favorite' is a FILTER that keeps the recency order", () => {
    expect(ids(queryLibrary(library, { ...base, sort: "favorite" }))).toEqual(["Frieren", "Le Fabuleux"]);
  });
  it("combines type + status + favourite", () => {
    expect(ids(queryLibrary(library, { ...base, type: "film", status: "completed", sort: "favorite" }))).toEqual(["Le Fabuleux"]);
  });
});

describe("queryLibrary — search is TITLE only, never tags", () => {
  it("matches the title, case-insensitively, trimmed", () => {
    expect(ids(queryLibrary(library, { ...base, search: "  dUnE " }))).toEqual(["Dune"]);
  });
  it("matches the original title too", () => {
    expect(ids(queryLibrary(library, { ...base, search: "amélie" }))).toEqual(["Le Fabuleux"]);
  });
  it("an empty or whitespace search is no search", () => {
    expect(queryLibrary(library, { ...base, search: "   " }).totalCount).toBe(library.length);
  });
  it("does not match a substring that only a genre tag would carry", () => {
    // "fantas" once returned every Fantasy-tagged title — the pipeline reads no tags at all.
    const tagged = library.map((r) => ({ ...r, tags: ["Fantasy"] }));
    expect(queryLibrary(tagged, { ...base, search: "fantas" }).totalCount).toBe(0);
  });
});

describe("queryLibrary — sort keys", () => {
  it("rating: highest first, unrated last", () => {
    expect(ids(queryLibrary(library, { ...base, sort: "rating" }))).toEqual(["Frieren", "Dune", "Andor", "Lost", "The Bear", "Le Fabuleux"]);
  });
  it("title: alphabetical", () => {
    expect(ids(queryLibrary(library, { ...base, sort: "title" }))).toEqual(["Andor", "Dune", "Frieren", "Le Fabuleux", "Lost", "The Bear"]);
  });
  it("year: newest first", () => {
    expect(ids(queryLibrary(library, { ...base, sort: "year" }))[0]).toBe("Frieren");
    expect(ids(queryLibrary(library, { ...base, sort: "year" })).at(-1)).toBe("Le Fabuleux");
  });
  it("added: a watch date wins, an in-progress row falls back to its update date", () => {
    // Andor has no watched_at but the most recent updated_at → first.
    expect(compareLibrary("added")(library[1], library[0])).toBeLessThan(0);
  });
  it("never mutates the input", () => {
    const copy = [...library];
    queryLibrary(library, { ...base, sort: "title" });
    expect(library).toEqual(copy);
  });
});

describe("queryLibrary — pagination", () => {
  const many = Array.from({ length: 95 }, (_, i) => row(`t${String(i).padStart(3, "0")}`, { updated_at: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z` }));
  it("slices by page size and reports the page count", () => {
    const r = queryLibrary(many, { ...base, sort: "title", page: 1 });
    expect(r.items).toHaveLength(40);
    expect(r.totalCount).toBe(95);
    expect(r.totalPages).toBe(3);
    expect(ids(queryLibrary(many, { ...base, sort: "title", page: 3 }))).toHaveLength(15);
  });
  it("clamps a page beyond the end to the last page — a filter that shrinks the list never shows an empty grid", () => {
    const r = queryLibrary(many, { ...base, sort: "title", page: 9 });
    expect(r.page).toBe(3);
    expect(r.items).toHaveLength(15);
  });
  it("clamps page 0 and negatives to the first page, and an empty result still has one page", () => {
    expect(queryLibrary(many, { ...base, page: 0 }).page).toBe(1);
    expect(queryLibrary([], base)).toEqual({ items: [], totalCount: 0, totalPages: 1, page: 1 });
  });
});
