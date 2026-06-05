/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getMediaDetails } from "../service";
import type { MediaType } from "../types";

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface CreditedDirector {
  id: number;
  name: string;
  profile_url: string | null;
}

export interface MediaCredits {
  cast: CastMember[];
  directors: CreditedDirector[];
}

function mapCredits(details: any, type: MediaType): MediaCredits {
  const credits = details?.credits ?? {};
  const aggregate = details?.aggregate_credits ?? {};
  // TV/anime: the recurring (voice) cast lives in aggregate_credits — `credits`
  // is often empty. Movies keep `credits`. Crew (directors) stays on `credits`.
  const rawCast: any[] =
    type === "film"
      ? credits.cast ?? []
      : (aggregate.cast?.length ? aggregate.cast : credits.cast) ?? [];
  const rawCrew: any[] = credits.crew ?? [];

  const cast: CastMember[] = rawCast
    .slice(0, 10)
    .map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character || person.roles?.[0]?.character || null,
      profile_url: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
    }));

  // Movies credit "Director"; series credit "Creator" / "Executive Producer".
  const directorJobs =
    type === "film"
      ? ["Director"]
      : ["Creator", "Series Director", "Executive Producer"];

  const seen = new Set<number>();
  const directors: CreditedDirector[] = rawCrew
    .filter((person) => directorJobs.includes(person.job))
    .filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    })
    .slice(0, 3)
    .map((person) => ({
      id: person.id,
      name: person.name,
      profile_url: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
    }));

  return { cast, directors };
}

export function useMediaCredits(tmdbId: number, type: MediaType, enabled = true) {
  return useQuery({
    queryKey: TMDB_KEYS.credits(type, tmdbId),
    queryFn: async () => {
      const tmdbType = type === "film" ? "movie" : "tv";
      const details = await getMediaDetails(tmdbId, tmdbType);
      return mapCredits(details, type);
    },
    staleTime: 24 * 60 * 60 * 1000, // credits don't change
    gcTime: 60 * 60 * 1000,
    enabled: enabled && !!tmdbId,
  });
}
