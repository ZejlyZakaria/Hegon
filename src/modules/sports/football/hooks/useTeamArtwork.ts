"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FOOTBALL_KEYS } from "./query-keys";

export interface TeamBackdrop {
  url: string;
  label: string;
}
export interface TeamArtwork {
  current: string | null;
  backdrops: TeamBackdrop[];
}

// Candidate backdrops for a team (fanart 1-4 + banner), fetched from TheSportsDB on demand — only
// when the artwork panel opens (`enabled`). Cached a day: the source barely changes.
export function useTeamArtwork(externalId: string, enabled: boolean) {
  return useQuery({
    queryKey: FOOTBALL_KEYS.teamArtwork(externalId),
    queryFn: async (): Promise<TeamArtwork> => {
      const res = await fetch(`/api/football/team-artwork/${externalId}`);
      if (!res.ok) throw new Error(`Artwork fetch failed: ${res.status}`);
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: enabled && !!externalId,
  });
}

// Persist the chosen backdrop into football_teams.fanart_url, then refresh the team so the hero
// re-renders with it.
export function useSetTeamFanart(externalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/football/team-artwork/${externalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Set backdrop failed: ${res.status}`);
      return (await res.json()) as { fanart_url: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: FOOTBALL_KEYS.teamFull(externalId) });
      // Move the "Current" ring to the just-picked backdrop WITHOUT refetching the candidate list
      // (that would re-hit TheSportsDB for nothing). Just patch the cached `current`.
      qc.setQueryData<TeamArtwork>(FOOTBALL_KEYS.teamArtwork(externalId), (old) =>
        old ? { ...old, current: data.fanart_url } : old,
      );
    },
  });
}
