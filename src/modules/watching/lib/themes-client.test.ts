import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { resolveThemeCovers, searchAnimeThemes, searchItunesArtwork, themeTrackKey } from "../service";
import { animeThemesOptions } from "../hooks/useAnimeThemes";
import { useThemePlayer, type PlayerTrack } from "../store/theme-player";
afterEach(() => { vi.unstubAllGlobals();useThemePlayer.getState().close(); });

it("uses same-origin lookup, distinguishes outage/empty and makes only one attempt", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ status: "unavailable" }));vi.stubGlobal("fetch", fetch);
  const client = new QueryClient();
  await expect(client.fetchQuery(animeThemesOptions("Hunter x Hunter", 2011))).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);expect(String(fetch.mock.calls[0][0])).toMatch(/^\/api\/watching\/anime-themes\?/);
  fetch.mockResolvedValue(Response.json({ status: "ok", groups: [] }));
  await expect(searchAnimeThemes("Unknown")).resolves.toEqual([]);client.clear();
});
it("retains a previously cached catalogue when a refresh fails", async () => {
  const client = new QueryClient();const options = animeThemesOptions("Air", 2005);
  const saved = [{ name: "Air", year: 2005, tracks: [] }];client.setQueryData(options.queryKey, saved);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  await client.invalidateQueries({queryKey:options.queryKey});
  await expect(client.fetchQuery(options)).rejects.toThrow();
  expect(client.getQueryData(options.queryKey)).toEqual(saved);client.clear();
});
it("deduplicates artwork, caps batch concurrency at four and caches successful art", async () => {
  let active=0,peak=0;
  const fetch=vi.fn(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return Response.json({results:[{artworkUrl100:"https://art.test/100x100bb.jpg"}]});});vi.stubGlobal("fetch",fetch);
  const tracks=Array.from({length:9},(_,n)=>({title:`batch-song-${n}`,artist:"test-artist"}));
  const result=await resolveThemeCovers([...tracks,tracks[0]]);
  expect(Object.keys(result)).toHaveLength(9);expect(fetch).toHaveBeenCalledTimes(9);expect(peak).toBe(4);
  await resolveThemeCovers(tracks);expect(fetch).toHaveBeenCalledTimes(9);
});
it("does not permanently cache artwork 503s and shares simultaneous lookups", async () => {
  const fetch=vi.fn().mockResolvedValue(new Response(null,{status:503}));vi.stubGlobal("fetch",fetch);
  await Promise.all([searchItunesArtwork("temporary-song","artist"),searchItunesArtwork("temporary-song","artist")]);expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValue(Response.json({results:[{artworkUrl100:"https://art.test/100x100bb.jpg"}]}));
  await expect(searchItunesArtwork("temporary-song","artist")).resolves.toContain("400x400bb");expect(fetch).toHaveBeenCalledTimes(2);
});
it("shares stable favorite identities and preserves queue/transport across surfaces", () => {
  const track:PlayerTrack={id:"",animeName:"Air",label:"OP1",title:"Opening",artist:"Artist",audioUrl:"https://a.test/1.ogg",videoUrl:null,cover:null,animePoster:null};
  track.id=themeTrackKey(track);const second={...track,id:"second",label:"ED1"};
  const otherSurface={...track,cover:"new-art",id:"another-surface"};expect(themeTrackKey(otherSurface)).toBe(track.id);
  const store=useThemePlayer;store.getState().play([track,second],0);store.getState().next();expect(store.getState().queue[store.getState().index]).toEqual(second);
  store.getState().prev();expect(store.getState().queue[store.getState().index].id).toBe(track.id);store.getState().next();store.getState().next();expect(store.getState().isPlaying).toBe(false);
});
