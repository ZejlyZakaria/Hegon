import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { getPersonBundle, getWatchlistPage, getAnimeCoursMany } from "./service";
import { mapCredits } from "./hooks/useMediaCredits";
afterEach(() => vi.unstubAllEnvs());
describe("Watching provider service contracts", () => {
  it("keeps movie/TV identities and multiple roles distinct in filmography", async () => {
    vi.stubEnv("TMDB_API_KEY", "test-key");
    const base = { id: 1399, poster_path: "/poster", vote_average: 8, popularity: 10 };
    server.use(http.get("https://api.themoviedb.org/3/person/1", () => HttpResponse.json({ id: 1, name: "Person", combined_credits: {
      cast: [{ ...base, media_type: "movie", title: "Film", character: "Lead", release_date: "2020-01-01" }, { ...base, media_type: "tv", name: "TV", character: "Lead", first_air_date: "2020-01-01" }],
      crew: [{ ...base, media_type: "tv", name: "TV", job: "Creator" }, { ...base, id: 2, media_type: "tv", name: "Production", job: "Executive Producer" }],
    } })));
    const { credits } = await getPersonBundle(1);
    expect(credits).toHaveLength(2);
    expect(credits.map((c) => c.type).sort()).toEqual(["film", "serie"]);
    expect(credits.find((c) => c.type === "serie")?.roles).toContainEqual({ role: "Creator", department: "Creating" });
  });
  it("keeps actual directors and TV creators with explicit roles, without a storage cap", () => {
    const crew = Array.from({ length: 5 }, (_, id) => ({ id, name: `Director ${id}`, job: "Director" }));
    const result = mapCredits({ credits: { crew: [...crew, { id: 99, name: "Producer", job: "Executive Producer" }] }, created_by: [{ id: 88, name: "Creator" }] }, "serie");
    expect(result.directors).toHaveLength(6);
    expect(result.directors.find((p) => p.id === 88)?.role).toBe("creator");
    expect(result.directors.some((p) => p.id === 99)).toBe(false);
    expect(result.directors.filter((p) => p.role === "director")).toHaveLength(5);
  });
});

describe("Watching complete collection requests", () => {
  const setup = () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://watching-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  };
  it("reads the final watchlist priority bucket after the first 100 items", async () => {
    setup();
    const counts: Record<string, number> = { "eq.high": 10, "eq.medium": 60, "eq.low": 30, "is.null": 20 };
    server.use(http.get("https://watching-test.supabase.co/rest/v1/media_items", ({ request }) => {
      const q = new URL(request.url).searchParams;
      const count = counts[q.get("priority_level")!] ?? 0;
      expect(q.get("want_to_watch")).toBe("eq.true");
      expect(q.get("type")).toBe("eq.film");
      expect(q.get("or")).toContain("and(or(release_date.lte.");
      const from = Number(q.get("offset") ?? 0);
      const size = Number(q.get("limit") ?? count);
      const items = Array.from({ length: Math.max(0, Math.min(size, count - from)) }, (_, i) => ({ id: `item-${from + i}` }));
      return HttpResponse.json(items, { headers: { "content-range": `${from}-${from + items.length - 1}/${count}` } });
    }));
    const page = await getWatchlistPage("user", "film", { sort: "priority", level: "all", search: "Title" }, 100);
    expect(page.total).toBe(120);
    expect(page.items).toHaveLength(20);
  });
  it("loads anime overlays beyond 1000 without an oversized ID query", async () => {
    setup();
    let calls = 0;
    server.use(http.get("https://watching-test.supabase.co/rest/v1/anime_cours", ({ request }) => {
      calls++;
      const filter = new URL(request.url).searchParams.get("tmdb_id")!;
      const ids = filter.slice(4, -1).split(",").map(Number);
      expect(ids.length).toBeLessThanOrEqual(200);
      return HttpResponse.json(ids.map((tmdb_id) => ({ tmdb_id, cours: [], source: "test" })));
    }));
    const rows = await getAnimeCoursMany(Array.from({ length: 1201 }, (_, i) => i + 1));
    expect(rows.size).toBe(1201);
    expect(calls).toBe(7);
  });
});
