/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AnimeThemeGroup, AnimeThemeTrack } from "../service";

function mapThemes(anime: any): AnimeThemeTrack[] {
  return (anime.animethemes ?? [])
    .map((t: any) => {
      if (!t || !Number.isInteger(t.id) || typeof t.slug !== "string" || typeof t.type !== "string") throw new Error("Malformed theme identity");
      const videos = (t.animethemeentries ?? []).flatMap((e: any) => e.videos ?? []);
      const video = videos.find((v: any) => v.audio?.link) ?? videos.find((v: any) => v.link);
      return {
        id: t.id,
        label: t.slug,
        type: t.type,
        title: t.song?.title ?? t.slug,
        artist: (t.song?.artists ?? []).map((a: any) => a.name).join(", "),
        audioUrl: video?.audio?.link ?? null,
        videoUrl: video?.link ?? null,
        cover: null,
      } as AnimeThemeTrack;
    })
    .filter((t: AnimeThemeTrack) => t.audioUrl || t.videoUrl);
}

const normName = (s: string) => s.toLowerCase().trim();

// Base franchise name — the anchor's name cut at the first season/part/movie/colon
// marker, so "Shingeki no Kyojin Season 2" and "…: The Final Season" both reduce to
// "shingeki no kyojin" and match every official TV season.
function franchiseBase(name: string): string {
  const n = normName(name);
  const cut = n.search(
    /(:|\s+season|\s+part|\s+movie|\s+ova|\s+the final|\s+\d)/,
  );
  return (cut > 0 ? n.slice(0, cut) : n).trim();
}

export function matchAnimeThemes(payload: unknown, title: string, year?: number | null): AnimeThemeGroup[] {
  const data = payload as { search?: { anime?: unknown } };
  if (!data || !Array.isArray(data.search?.anime)) throw new Error("Malformed AnimeThemes response");
  const animeList: any[] = data.search.anime;
  if (animeList.some(a => !a || typeof a.name !== "string" || typeof a.media_format !== "string" || (a.animethemes != null && !Array.isArray(a.animethemes)) || (a.animesynonyms != null && !Array.isArray(a.animesynonyms)))) throw new Error("Malformed AnimeThemes entries");
  const tv = animeList.filter((a) => a.media_format === "TV");
  if (tv.length === 0) return [];

  // IDENTITY CHECK. AnimeThemes' fuzzy search returns *an* anime even for a title it doesn't have —
  // so "Idaten Jump" (absent from its library) came back as the look-alike "Heion Sedai no
  // Idaten-tachi". Only trust a result whose NAME or one of its SYNONYMS genuinely matches the title:
  // the English title lives in the synonyms, which is how a romaji-named show (Shingeki no Kyojin)
  // still matches "Attack on Titan". No verified match → show nothing, not the wrong show.
  const key = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const wanted = key(title);
  if (!wanted) return [];
  const matchesTitle = (a: any) =>
    [a.name, ...(a.animesynonyms ?? []).map((s: any) => s.text)]
      .filter(Boolean)
      .map(key)
      // Exact title (covers short names like "Air"), or a length-guarded substring either way
      // (covers "Demon Slayer: Kimetsu no Yaiba" ⊇ "Kimetsu no Yaiba"), never a 2-letter coincidence.
      .some(
        (c: string) =>
          c === wanted ||
          (wanted.length >= 5 && c.length >= 5 && (c.includes(wanted) || wanted.includes(c))),
      );

  const verified = tv.filter(matchesTitle);
  if (verified.length === 0) return [];

  // Anchor = the VERIFIED entry closest to the media's year (the season being viewed).
  const anchor =
    year != null
      ? [...verified].sort(
          (a, b) =>
            Math.abs((a.year ?? 9999) - year) -
            Math.abs((b.year ?? 9999) - year),
        )[0]
      : verified[0];
  const base = franchiseBase(anchor.name);
  const floor = anchor.year ?? 0; // the adaptation you're viewing — exclude older remakes

  const groups = tv
    .filter(
      (a) => (normName(a.name) === base || normName(a.name).startsWith(`${base} `) || normName(a.name).startsWith(`${base}:`)) && (a.year ?? 9999) >= floor,
    )
    .map((anime) => ({
      name: anime.name as string,
      year: (anime.year as number) ?? null,
      tracks: mapThemes(anime),
    }))
    .filter((g) => g.tracks.length > 0)
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  return groups;
}
