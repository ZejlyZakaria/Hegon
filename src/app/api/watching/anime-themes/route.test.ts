import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), limit: vi.fn(), themes: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({ createServerClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/shared/lib/ratelimit", () => ({ tmdbRatelimit: { limit: mocks.limit } }));
vi.mock("@/modules/watching/anime-themes-server", () => ({ getAnimeThemes: mocks.themes }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks();mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } } });mocks.limit.mockResolvedValue({ success: true }); });
const request = (query = "title=Hunter+x+Hunter&year=2011") => new NextRequest(`http://localhost/api/watching/anime-themes?${query}`);
it("requires authentication before reaching the provider", async () => {
  mocks.claims.mockResolvedValue({ data: null });expect((await GET(request())).status).toBe(401);expect(mocks.themes).not.toHaveBeenCalled();
});
it.each(["", "title=Air&year=nan", "title=Air&year=9999", `title=${"a".repeat(201)}`])("rejects invalid query %s", async query => {
  expect((await GET(request(query))).status).toBe(400);expect(mocks.themes).not.toHaveBeenCalled();
});
it("keeps a real empty result distinct from an unavailable provider", async () => {
  mocks.themes.mockResolvedValue([]);const empty = await GET(request());expect(await empty.json()).toEqual({ status: "ok", groups: [] });
  mocks.themes.mockRejectedValue(new Error("503 private upstream diagnostic"));const down = await GET(request());
  expect(down.status).toBe(200);expect(await down.json()).toEqual({ status: "unavailable" });expect(down.headers.get("cache-control")).toContain("no-store");
});
it("respects throttling without calling AnimeThemes", async () => {
  mocks.limit.mockResolvedValue({ success: false });expect((await GET(request())).status).toBe(429);expect(mocks.themes).not.toHaveBeenCalled();
});

it("contains a failed limiter without bypassing it or reaching the provider",async()=>{
 mocks.limit.mockRejectedValueOnce(new Error("limiter down"));const response=await GET(request());
 expect(await response.json()).toEqual({status:"unavailable"});expect(mocks.themes).not.toHaveBeenCalled();
});
