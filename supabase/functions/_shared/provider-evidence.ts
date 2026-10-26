/** Compact contract only: never retain the full transport payload. */
export interface EpisodeEvidence { id: number; number: number; air_date: string | null; aired: boolean | null; runtime?: number | null }
export interface SeasonEvidence { id: number; number: number; announced: number; aired: number | null; end_date: string | null; episodes: EpisodeEvidence[] }
export function compactSeason(season: { id: number; season_number: number; episode_count: number }, episodes: { id: number; episode_number: number; air_date: string | null; runtime?: number | null }[], today: string, precedingEpisodes = 0): SeasonEvidence {
  if (!Number.isSafeInteger(season.id) || season.id <= 0 || !Number.isSafeInteger(season.season_number) || season.season_number <= 0
    || !Number.isSafeInteger(season.episode_count) || season.episode_count < 0 || !Array.isArray(episodes)) throw new Error("Invalid season evidence");
  // Some anime keep absolute broadcast numbering across seasons (e.g. 63..136).
  // Normalize only a complete block proven by the preceding seasons' exact counts.
  const local=episodes.every(e=>Number.isSafeInteger(e.episode_number) && e.episode_number>=1 && e.episode_number<=season.episode_count);
  if (!local && season.season_number>1 && Number.isSafeInteger(precedingEpisodes) && precedingEpisodes>0 && episodes.length===season.episode_count &&
      episodes.every(e=>Number.isSafeInteger(e.episode_number) && e.episode_number>precedingEpisodes && e.episode_number<=precedingEpisodes+season.episode_count)) {
    episodes=episodes.map(e=>({...e,episode_number:e.episode_number-precedingEpisodes}));
  }
  const ids = new Set<number>(), numbers = new Set<number>();
  const membership = episodes.map((e) => {
    if (!Number.isSafeInteger(e.id) || e.id <= 0 || !Number.isSafeInteger(e.episode_number) || e.episode_number <= 0
      || e.episode_number > season.episode_count || ids.has(e.id) || numbers.has(e.episode_number)
      || (e.air_date != null && (!/^\d{4}-\d{2}-\d{2}$/.test(e.air_date) || !Number.isFinite(Date.parse(e.air_date)) || new Date(e.air_date).toISOString().slice(0,10) !== e.air_date))) throw new Error("Invalid episode evidence");
    ids.add(e.id); numbers.add(e.episode_number);
    return { id: e.id, number: e.episode_number, air_date: e.air_date ?? null, aired: e.air_date == null ? null : e.air_date <= today, ...(e.runtime !== undefined ? {runtime: typeof e.runtime === "number" && Number.isFinite(e.runtime) && e.runtime>0 && e.runtime<=1440 ? e.runtime : null} : {}) };
  }).sort((a,b) => a.number-b.number);
  const aired = membership.filter((e) => e.aired === true);
  const known = membership.every((e) => e.aired !== null);
  // Missing membership is not evidence of zero. A complete empty season really is zero.
  if (membership.length !== season.episode_count) throw new Error("Incomplete episode membership");
  if (known && aired.some((e,i) => e.number !== i+1)) throw new Error("Noncontiguous aired membership");
  return { id: season.id, number: season.season_number, announced: season.episode_count, aired: known ? aired.length : null,
    end_date: known && aired.length > 0 && aired.length === season.episode_count ? aired.at(-1)!.air_date : null, episodes: membership };
}
