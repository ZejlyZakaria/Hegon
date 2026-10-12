import { creditRole, type CreditRole } from "../lib/credit-roles";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { TMDB_KEYS } from "./query-keys";
import { getMediaDetails } from "../service";
import type { MediaType } from "../types";
import { STALE } from "@/shared/lib/stale";

export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profile_url: string | null;
}

export interface CreditedDirector {
  role?: CreditRole;
  id: number;
  name: string;
  profile_url: string | null;
}

export interface MediaCredits {
  cast: CastMember[];
  directors: CreditedDirector[];
}

export function mapCredits(details: any, type: MediaType): MediaCredits {
  const credits = details?.credits ?? {};
  const aggregate = details?.aggregate_credits ?? {};
  // TV/anime: the recurring (voice) cast lives in aggregate_credits — `credits`
  // is often empty. Movies keep `credits`. Crew (directors) stays on `credits`.
  const rawCast: any[] =
    type === "film"
      ? credits.cast ?? []
      : (aggregate.cast?.length ? aggregate.cast : credits.cast) ?? [];
  const rawCrew: any[] = credits.crew ?? [];

  // The WHOLE cast is kept on the row — no cap. Display slices this to the top dozen, but the
  // person-page ranking counts every title an actor appears in, and a real cameo can be billed dead
  // last: Gary Oldman is #78 of 80 in Oppenheimer. Any cap drops exactly those roles and makes the
  // rank disagree with the count shown ("watched them in 9" but ranked as an 8).
  const cast: CastMember[] = rawCast
    .map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character || person.roles?.[0]?.character || null,
      profile_url: person.profile_path
        ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
        : null,
    }));

  const seen = new Set<number>();
  const directors: CreditedDirector[] = [...rawCrew, ...(details?.created_by ?? []).map((p: any) => ({ ...p, job: "Creator" }))]
    .filter((person) => ["director", "creator"].includes(creditRole(person.job, type) ?? ""))
    .sort((a, b) => Number(creditRole(b.job, type) === "director") - Number(creditRole(a.job, type) === "director"))
    .filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    })
    .map((person) => ({
      id: person.id,
      role: creditRole(person.job, type) as CreditRole,
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
    staleTime: STALE.DAY, // credits don't change
    gcTime: STALE.DAY,
    enabled: enabled && !!tmdbId,
  });
}
