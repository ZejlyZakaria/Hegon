import type { MediaType } from "../types";
export interface OwnedRow { id: string; type: MediaType }
export type OwnedMap = Record<string, OwnedRow>;
export interface CatalogueResult { id: number; media_type?: string | null }
/** Anime is a classification inside the TMDB TV namespace. */
export const tmdbKind = (type: MediaType | "movie" | "tv") => type === "film" || type === "movie" ? "movie" : "tv";
export const mediaIdentity = (type: MediaType | "movie" | "tv", id: number) => `${tmdbKind(type)}:${id}`;
export function ownedRowFor(r: CatalogueResult, owned: OwnedMap): OwnedRow | null {
  if (r.media_type !== "movie" && r.media_type !== "tv") return null;
  return owned[mediaIdentity(r.media_type, r.id)] ?? null;
}
export function buildOwnedMap(rows: (OwnedRow & { tmdb_id: number })[]): OwnedMap {
  const out: OwnedMap = {};
  for (const row of rows) {
    const key = mediaIdentity(row.type, row.tmdb_id);
    if (!out[key]) out[key] = { id: row.id, type: row.type };
  }
  return out;
}
