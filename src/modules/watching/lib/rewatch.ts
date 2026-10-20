import { assertion, viewingDate, type ViewingAssertion, type ViewingRange } from "./viewing-history";
import type { WatchDateParts } from "./watched-date";
export interface RewatchScope {
  kind: "WHOLE_TITLE" | "SEASON" | "COUR" | "EPISODES";
  number?: number;
  courId?: number;
  ranges?: { season: number; from: number; to: number }[];
}
export interface RewatchRequest { date: WatchDateParts | null; scope: RewatchScope; replaces?: string }
export interface RewatchCatalogue {
  snapshot_id: string | null; mapping_snapshot_id: string | null;
  seasons: { id: number; number: number; announced: number; aired: number | null; episodes: { id: number; number: number; aired: boolean | null; air_date?: string | null }[] }[];
  cours: { id: number; number: number; start: number; end: number | null }[];
}
export const emptyCatalogue = (): RewatchCatalogue => ({ snapshot_id: null, mapping_snapshot_id: null, seasons: [], cours: [] });
/** Facts are frozen at the click. A median TV runtime is NOT actual episode runtime evidence. */
export function buildRewatch(media: { type: string; runtime: number | null; season_aired?: number[] | null }, request: RewatchRequest,
  catalogue: RewatchCatalogue, runtimes: Readonly<Record<string, number>> = {}): ViewingAssertion {
  const date = viewingDate(request.date), scope = request.scope;
  const now=new Date();
  if (date.year!=null && (date.year>now.getFullYear() || date.year===now.getFullYear() && date.month!=null && (date.month>now.getMonth()+1 || date.month===now.getMonth()+1 && date.day!=null && date.day>now.getDate()))) throw new Error("A rewatch cannot be in the future");
  const ranges: ViewingRange[] = [];
  let key: string | null = null;
  const add = (season: number, from: number, to: number) => {
    const evidence = catalogue.seasons.find(s => s.number === season);
    const ceiling = evidence?.aired ?? media.season_aired?.[season-1];
    if (!Number.isInteger(season) || season<1 || !Number.isInteger(from) || !Number.isInteger(to) || from<1 || to<from || ceiling == null || to>ceiling) throw new Error("Choose an available episode range");
    if (ranges.some(r => r.season_number_at_recording===season && r.episode_from<=to && r.episode_to>=from)) throw new Error("Episode ranges overlap");
    const episodes = evidence?.episodes.filter(e => e.aired && e.number>=from && e.number<=to).sort((a,b) => a.number-b.number);
    const ids = episodes?.length===to-from+1 ? episodes.map(e => e.id) : null;
    if (date.year!=null && episodes?.some(e => e.air_date && (Number(e.air_date.slice(0,4))>date.year! || Number(e.air_date.slice(0,4))===date.year && date.month!=null && (Number(e.air_date.slice(5,7))>date.month || Number(e.air_date.slice(5,7))===date.month && date.day!=null && Number(e.air_date.slice(8,10))>date.day)))) throw new Error("Selected episodes had not aired in that period");
    const durations = Array.from({ length: to-from+1 },(_,i) => runtimes[`${season}:${from+i}`]);
    const known = durations.every(n => Number.isFinite(n) && n>0);
    if (!known && durations.some(n=>Number.isFinite(n) && n>0)) {
      // Preserve known subtotals without assigning runtime to the unknown episodes.
      durations.forEach((minutes,index)=>ranges.push({season_key:`tmdb-season:${season}`,season_number_at_recording:season,episode_from:from+index,episode_to:from+index,
        episode_ids:ids ? [ids[index]] : null,minutes:Number.isFinite(minutes) && minutes>0 ? minutes : null,duration_basis:Number.isFinite(minutes) && minutes>0 ? "RUNTIME_SNAPSHOT" : "UNKNOWN"}));
    } else ranges.push({ season_key: `tmdb-season:${season}`, season_number_at_recording: season, episode_from: from, episode_to: to,
      episode_ids: ids, minutes: known ? durations.reduce((a,b) => a+b,0) : null, duration_basis: known ? "RUNTIME_SNAPSHOT" : "UNKNOWN" });
  };
  if (media.type === "film") {
    if (scope.kind!=="WHOLE_TITLE") throw new Error("Movies use whole-title scope");
    const known = media.runtime != null && media.runtime>0;
    ranges.push({ season_key: "movie", season_number_at_recording: 0, episode_from: 1, episode_to: 1, episode_ids: null,
      minutes: known ? media.runtime : null, duration_basis: known ? "RUNTIME_SNAPSHOT" : "UNKNOWN" });
  } else if (scope.kind === "WHOLE_TITLE") {
    const seasons = catalogue.seasons.length ? catalogue.seasons.map(s => ({ number: s.number, aired: s.aired })) : (media.season_aired ?? []).map((aired,i) => ({ number: i+1, aired }));
    if (!seasons.length || seasons.some(s => s.aired==null)) throw new Error("Whole-title coverage is unknown; select known episodes instead");
    seasons.forEach(s => { if (s.aired!>0) add(s.number,1,s.aired!); });
  } else if (scope.kind === "SEASON") {
    const s = catalogue.seasons.find(s => s.number===scope.number);
    const n = scope.number ?? 0;
    add(n,1,s?.aired ?? media.season_aired?.[n-1] ?? 0);
    key = s ? `tmdb-season:${s.id}` : `tmdb-season:${n}`;
  } else if (scope.kind === "COUR") {
    const c = catalogue.cours.find(c => c.number===scope.number && c.id===scope.courId);
    if (!c || c.end==null) throw new Error("Cour identity or range changed; refresh before recording");
    // Flat offsets require accepted season identity/membership, not aired-count guesses.
    const seasons=[...catalogue.seasons].sort((a,b)=>a.number-b.number);
    if (!catalogue.snapshot_id || !seasons.length || seasons.some((s,i)=>s.number!==i+1 || !Number.isInteger(s.announced) || s.announced<1 || s.aired==null)) {
      throw new Error("Refresh season details before recording this rewatch");
    }
    let offset=0;
    for (const s of seasons) {
      const from=Math.max(1,c.start-offset), to=Math.min(s.aired ?? 0,c.end-offset);
      if (from<=to) {
        const members=s.episodes.filter(e=>e.aired===true && e.number>=from && e.number<=to);
        if (new Set(members.map(e=>e.number)).size!==to-from+1 || members.some(e=>!Number.isInteger(e.id) || e.id<=0)) throw new Error("Refresh season details before recording this rewatch");
        add(s.number,from,to);
      }
      offset+=s.announced;
    }
    if (ranges.reduce((n,r)=>n+r.episode_to-r.episode_from+1,0)!==c.end-c.start+1) throw new Error("Refresh season details before recording this rewatch");
    key=`anilist-cour:${c.id}`;
  } else if (scope.kind === "EPISODES") {
    if (!scope.ranges?.length || scope.ranges.length>100) throw new Error("Choose explicit episode ranges");
    scope.ranges.forEach(r => add(r.season,r.from,r.to));
  } else throw new Error("Explicit rewatch scope required");
  if (!ranges.length) throw new Error("No known available coverage");
  return { ...assertion("REWATCH",date,ranges,!!request.replaces), scope_kind: scope.kind, scope_key: key,
    scope_confidence: "CONFIRMED", ...(request.replaces ? { supersedes_id: request.replaces } : {}) };
}
export function parseEpisodeRanges(input: string): NonNullable<RewatchScope["ranges"]> {
  return input.split(",").map(part => {
    const match=/^\s*S?(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/i.exec(part);
    if (!match) throw new Error("Use S1:4-8, S2:1-3");
    return { season: Number(match[1]), from: Number(match[2]), to: Number(match[3] ?? match[2]) };
  });
}
