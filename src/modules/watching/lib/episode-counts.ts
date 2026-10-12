/** Legacy duration estimates may use announcements only where airing metadata is missing. */
export function episodeCountsForTime(m: { season_aired?: number[] | null; season_episodes?: number[] | null; episodes?: number | null }): number[] {
  const shape = m.season_episodes ?? m.season_aired;
  if (shape == null) return m.episodes == null ? [] : [m.episodes];
  return Array.from({ length: Math.max(shape.length, m.season_aired?.length ?? 0) }, (_, i) => m.season_aired?.[i] ?? m.season_episodes?.[i] ?? 0);
}

export function hasEstimatedEpisodeCounts(m: Parameters<typeof episodeCountsForTime>[0]): boolean {
  return episodeCountsForTime(m).some((_, i) => m.season_aired?.[i] == null);
}
