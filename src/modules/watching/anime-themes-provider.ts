import { matchAnimeThemes } from "./lib/anime-themes";

/** Fixed provider URL, bounded wait, no retry. Only validated results may enter the server cache. */
export async function fetchAnimeThemes(title: string, year: number | null) {
  const url = new URL("https://api.animethemes.moe/search");
  url.searchParams.set("q", title);
  url.searchParams.set("fields[search]", "anime");
  url.searchParams.set("include[anime]", "animesynonyms,animethemes.song.artists,animethemes.animethemeentries.videos.audio");
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("AnimeThemes unavailable");
  return matchAnimeThemes(await response.json(), title, year);
}
