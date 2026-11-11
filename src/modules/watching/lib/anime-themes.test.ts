import { afterEach, describe, expect, it, vi } from "vitest";
import { matchAnimeThemes } from "./anime-themes";
import { fetchAnimeThemes } from "../anime-themes-provider";

const track = { id: 1, slug: "OP1", type: "OP", song: { title: "Opening", artists: [{ name: "Artist" }] }, animethemeentries: [{ videos: [{ audio: { link: "https://a.animethemes.moe/song.ogg" }, link: "https://v.animethemes.moe/song.webm" }] }] };
const anime = (name: string, year = 2013, synonyms: string[] = [], format = "TV") => ({ name, year, media_format: format, animesynonyms: synonyms.map(text => ({ text })), animethemes: [track] });
const payload = (...entries: ReturnType<typeof anime>[]) => ({ search: { anime: entries } });
afterEach(() => vi.unstubAllGlobals());

describe("AnimeThemes identity and franchise", () => {
  it("matches an English synonym and groups official later TV seasons, excluding older adaptations, films and prefix collisions", () => {
    const data = payload(anime("Shingeki no Kyojin", 2013, ["Attack on Titan"]), anime("Shingeki no Kyojin Season 2", 2017), anime("Shingeki no Kyojin: The Final Season", 2020), anime("Shingeki no Kyojin", 2000), anime("Shingeki no Kyojin Movie", 2014, [], "MOVIE"), anime("Shingeki no Kyojinz", 2018));
    expect(matchAnimeThemes(data, "Attack on Titan", 2013).map(g => g.year)).toEqual([2013, 2017, 2020]);
  });
  it("rejects unrelated fuzzy matches and short substring coincidences", () => {
    expect(matchAnimeThemes(payload(anime("Heion Sedai no Idaten-tachi")), "Idaten Jump")).toEqual([]);
    expect(matchAnimeThemes(payload(anime("Fairy Tail")), "Air")).toEqual([]);
    expect(matchAnimeThemes(payload(anime("Air")), "Air")).toHaveLength(1);
  });
  it("distinguishes a legitimate empty result from malformed provider data", () => {
    expect(matchAnimeThemes({ search: { anime: [] } }, "Unknown")).toEqual([]);
    expect(() => matchAnimeThemes({ error: "maintenance" }, "Unknown")).toThrow();
    expect(() => matchAnimeThemes({ search: { anime: [null] } }, "Unknown")).toThrow();
  });
  it("uses a playable variant when the first entry has no video", () => {
    const entry = anime("Air");entry.animethemes[0] = { ...track, animethemeentries: [{ videos: [] }, ...track.animethemeentries] };
    expect(matchAnimeThemes(payload(entry), "Air")[0].tracks[0].audioUrl).toContain("song.ogg");
  });
});

describe("Optional provider boundary", () => {
  it("returns validated tracks without waiting for artwork", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(payload(anime("Air"))));vi.stubGlobal("fetch", fetch);
    expect((await fetchAnimeThemes("Air", 2005))[0].tracks[0]).toMatchObject({ label: "OP1", cover: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].hostname).toBe("api.animethemes.moe");
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it.each([503, 404, 429])("does not convert HTTP %s into a cached empty catalogue or retry it", async status => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status }));vi.stubGlobal("fetch", fetch);
    await expect(fetchAnimeThemes("Air", null)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([new TypeError("network"), new DOMException("timed out", "TimeoutError")])("contains network/timeout failure at the boundary", async error => {
    const fetch = vi.fn().mockRejectedValue(error);vi.stubGlobal("fetch", fetch);
    await expect(fetchAnimeThemes("Air", null)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
  });
});

it("keeps non-Latin identities distinct rather than normalizing both to an empty string",()=>{
 expect(matchAnimeThemes(payload(anime("\u65e5\u672c")),"\u65e5\u672c")).toHaveLength(1);
 expect(matchAnimeThemes(payload(anime("\u65e5\u672c")),"\u4e2d\u56fd")).toEqual([]);
 expect(matchAnimeThemes(payload(anime("Air")),"...")).toEqual([]);
});
