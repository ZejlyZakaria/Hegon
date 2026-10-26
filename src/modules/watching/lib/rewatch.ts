import { assertion, viewingDate, parseViewingInput as parseViewingAirDate, type ViewingAssertion, type ViewingRange } from "./viewing-history";
import type { WatchDateParts } from "./watched-date";
export interface RewatchScope {
  kind: "WHOLE_TITLE" | "SEASON" | "COUR" | "EPISODES" | "UNKNOWN";
  selections?: { number: number; courId?: number }[];
  number?: number;
  courId?: number;
  ranges?: { season: number; from: number; to: number }[];
}
export interface RewatchRequest { date: WatchDateParts | null; scope: RewatchScope; replaces?: string; legacyId?: string }
export interface RewatchCatalogue {
  snapshot_id: string | null; mapping_snapshot_id: string | null;
  seasons: { id: number; number: number; announced: number; aired: number | null; episodes: { id: number; number: number; aired: boolean | null; air_date?: string | null; runtime?: number | null }[] }[];
  cours: { id: number; number: number; start: number; end: number | null }[];
}
export const emptyCatalogue = (): RewatchCatalogue => ({ snapshot_id: null, mapping_snapshot_id: null, seasons: [], cours: [] });
/** Last possible day of the supplied period, capped at today; never persisted as watch precision. */
export function rewatchCutoff(parts: WatchDateParts | null, now = new Date()): string {
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const date = viewingDate(parts);
  if (date.year == null) return today;
  const month=date.month ?? 12;
  const day=date.day ?? new Date(Date.UTC(date.year,month,0)).getUTCDate();
  const end=`${String(date.year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  if (`${date.year}`>today.slice(0,4) || date.month!=null && end.slice(0,7)>today.slice(0,7) || date.day!=null && end>today) throw new Error("A rewatch cannot be in the future");
  return end<today ? end : today;
}
/** Historical membership comes from dated episodes, never today's count or announced seasons. */
export function catalogueAtDate(catalogue: RewatchCatalogue, parts: WatchDateParts | null, relevant?: ReadonlySet<number>): RewatchCatalogue {
  const cutoff=rewatchCutoff(parts), past=cutoff<rewatchCutoff(null);
  return {...catalogue,seasons:catalogue.seasons.map(s=>{
    if (relevant && !relevant.has(s.number)) return s;
    if (s.aired!=null && s.episodes.filter(e=>e.aired===true).length!==s.aired || s.episodes.length!==s.announced || new Set(s.episodes.map(e=>e.number)).size!==s.episodes.length || new Set(s.episodes.map(e=>e.id)).size!==s.episodes.length) throw new Error("Refresh season details before recording this rewatch");
    const episodes=s.episodes.map(e=>{
      if (e.air_date) { if(!/^\d{4}-\d{2}-\d{2}$/.test(e.air_date)) throw new Error("Invalid episode air date"); parseViewingAirDate(e.air_date); }
      if (!e.air_date && (past && e.aired!==false || e.aired==null)) throw new Error("Historical episode availability is unknown for this period");
      return {...e,aired:e.air_date ? e.air_date<=cutoff : e.aired};
    });
    return {...s,episodes,aired:episodes.filter(e=>e.aired===true).length};
  })};
}
/** Facts are frozen at the click. A median TV runtime is NOT actual episode runtime evidence. */
export function buildRewatch(media: { type: string; runtime: number | null; release_date?: string | null; season_aired?: number[] | null }, request: RewatchRequest,
  catalogue: RewatchCatalogue, runtimes: Readonly<Record<string, number>> = {}): ViewingAssertion {
  const date = viewingDate(request.date), scope = request.scope;
  const cutoff=rewatchCutoff(request.date);
  if(media.type==="film" && media.release_date && cutoff<media.release_date) throw new Error("The movie had not been released in that period");
  if (scope.kind==="UNKNOWN") return {...assertion("REWATCH",date,[],!!(request.replaces || request.legacyId)),scope_kind:"UNKNOWN",scope_confidence:"UNKNOWN",...(request.replaces ? {supersedes_id:request.replaces}:{})};
  if (scope.selections) {
    if (!scope.selections.length || new Set(scope.selections.map(s=>s.number)).size!==scope.selections.length || !["SEASON","COUR"].includes(scope.kind)) throw new Error("Select at least one season");
    const selected=scope.selections.map(s=>buildRewatch(media,{...request,scope:{kind:scope.kind,number:s.number,courId:s.courId}},catalogue,runtimes));
    const all=selected.flatMap(s=>s.ranges);
    if (all.some((r,i)=>all.slice(0,i).some(p=>p.season_number_at_recording===r.season_number_at_recording && p.episode_from<=r.episode_to && p.episode_to>=r.episode_from))) throw new Error("Selected seasons overlap; refresh viewing details");
    return {...selected[0],ranges:all,scope_kind:selected.length===1 ? selected[0].scope_kind : "EPISODES",scope_key:selected.length===1 ? selected[0].scope_key : null};
  }
  const today=rewatchCutoff(null);
  if (media.type!=="film" && !catalogue.seasons.length && rewatchCutoff(request.date)<today) throw new Error("Historical episode availability is unknown; refresh season details");
  let relevant:Set<number>|undefined;
  if(scope.kind==="SEASON") relevant=new Set([scope.number ?? 0]);
  if(scope.kind==="EPISODES") relevant=new Set(scope.ranges?.map(r=>r.season));
  if(scope.kind==="COUR") {
    const cour=catalogue.cours.find(c=>c.number===scope.number && c.id===scope.courId);
    if(!cour) throw new Error("Cour identity or range changed; refresh before recording");
    const next=catalogue.cours.filter(c=>c.start>cour.start).sort((a,b)=>a.start-b.start)[0];
    const end=cour.end ?? (next ? next.start-1 : Infinity);
    let offset=0;relevant=new Set();
    for(const s of [...catalogue.seasons].sort((a,b)=>a.number-b.number)) {
      if(offset+s.announced>=cour.start && offset<end) relevant.add(s.number);
      offset+=s.announced;
    }
  }
  catalogue=catalogueAtDate(catalogue,request.date,relevant);
  const ranges: ViewingRange[] = [];
  let key: string | null = null;
  const add = (season: number, from: number, to: number) => {
    const evidence = catalogue.seasons.find(s => s.number === season);
    const ceiling = evidence ? Math.max(0,...evidence.episodes.filter(e=>e.aired===true).map(e=>e.number)) : media.season_aired?.[season-1];
    if (!Number.isInteger(season) || season<1 || !Number.isInteger(from) || !Number.isInteger(to) || from<1 || to<from || ceiling == null || to>ceiling) throw new Error("Choose an available episode range");
    if (ranges.some(r => r.season_number_at_recording===season && r.episode_from<=to && r.episode_to>=from)) throw new Error("Episode ranges overlap");
    const episodes = evidence?.episodes.filter(e => e.aired && e.number>=from && e.number<=to).sort((a,b) => a.number-b.number);
    if (evidence && episodes?.length!==to-from+1) throw new Error("Selected episodes were not available in this period");
    const ids = episodes?.length===to-from+1 ? episodes.map(e => e.id) : null;
    if (date.year!=null && episodes?.some(e => e.air_date && (Number(e.air_date.slice(0,4))>date.year! || Number(e.air_date.slice(0,4))===date.year && date.month!=null && (Number(e.air_date.slice(5,7))>date.month || Number(e.air_date.slice(5,7))===date.month && date.day!=null && Number(e.air_date.slice(8,10))>date.day)))) throw new Error("Selected episodes had not aired in that period");
    const durations = Array.from({ length: to-from+1 },(_,i) => evidence?.episodes.find(e=>e.number===from+i)?.runtime ?? runtimes[`${season}:${from+i}`]);
    const known = durations.every(n => Number.isFinite(n) && n>0);
    if (!known && durations.some(n=>Number.isFinite(n) && n>0)) {
      // Preserve known subtotals without assigning runtime to the unknown episodes.
      durations.forEach((minutes,index)=>ranges.push({season_key:`tmdb-season:${season}`,season_number_at_recording:season,episode_from:from+index,episode_to:from+index,
        episode_ids:ids ? [ids[index]] : null,minutes:Number.isFinite(minutes) && minutes>0 ? minutes : null,duration_basis:Number.isFinite(minutes) && minutes>0 ? "RUNTIME_SNAPSHOT" : "UNKNOWN"}));
    } else ranges.push({ season_key: `tmdb-season:${season}`, season_number_at_recording: season, episode_from: from, episode_to: to,
      episode_ids: ids, minutes: known ? durations.reduce((a,b) => a+b,0) : null, duration_basis: known ? "RUNTIME_SNAPSHOT" : "UNKNOWN" });
  };
  const addAvailable = (season:number,from=1,to=Number.MAX_SAFE_INTEGER) => {
    const evidence=catalogue.seasons.find(s=>s.number===season);
    if (!evidence) { if(catalogue.seasons.length) throw new Error("Season is unavailable in this catalogue"); const aired=media.season_aired?.[season-1]; if (aired==null) throw new Error("Season availability is unknown"); if (Math.min(aired,to)>=from) add(season,from,Math.min(aired,to)); return; }
    const available=evidence.episodes.filter(e=>e.aired===true && e.number>=from && e.number<=to).sort((a,b)=>a.number-b.number);
    let start=0;
    for(let i=0;i<available.length;i++) if(i===available.length-1 || available[i+1].number!==available[i].number+1) { add(season,available[start].number,available[i].number);start=i+1; }
  };
  if (media.type === "film") {
    if (scope.kind!=="WHOLE_TITLE") throw new Error("Movies use whole-title scope");
    const known = media.runtime != null && media.runtime>0;
    ranges.push({ season_key: "movie", season_number_at_recording: 0, episode_from: 1, episode_to: 1, episode_ids: null,
      minutes: known ? media.runtime : null, duration_basis: known ? "RUNTIME_SNAPSHOT" : "UNKNOWN" });
  } else if (scope.kind === "WHOLE_TITLE") {
    const seasons = catalogue.seasons.length ? catalogue.seasons.map(s => ({ number: s.number, aired: s.aired })) : (media.season_aired ?? []).map((aired,i) => ({ number: i+1, aired }));
    if (!seasons.length || seasons.some(s => s.aired==null)) throw new Error("Whole-title coverage is unknown; select known episodes instead");
    seasons.forEach(s => { if (s.aired!>0) addAvailable(s.number); });
  } else if (scope.kind === "SEASON") {
    const s = catalogue.seasons.find(s => s.number===scope.number);
    const n = scope.number ?? 0;
    addAvailable(n);
    key = s ? `tmdb-season:${s.id}` : `tmdb-season:${n}`;
  } else if (scope.kind === "COUR") {
    const c = catalogue.cours.find(c => c.number===scope.number && c.id===scope.courId);
    if (!c) throw new Error("Cour identity or range changed; refresh before recording");
    // Flat offsets require accepted season identity/membership, not aired-count guesses.
    const seasons=[...catalogue.seasons].sort((a,b)=>a.number-b.number);
    if (!catalogue.snapshot_id || !seasons.length || seasons.some((s,i)=>s.number!==i+1 || !Number.isInteger(s.announced) || s.announced<0)) {
      throw new Error("Refresh season details before recording this rewatch");
    }
    const next=catalogue.cours.filter(other=>other.start>c.start).sort((a,b)=>a.start-b.start)[0];
    const end=c.end ?? (next ? next.start-1 : Number.NaN);
    const upper=Number.isFinite(end) ? end : seasons.reduce((n,s)=>n+s.announced,0);
    let offset=0;
    for (const s of seasons) {
      const from=Math.max(1,c.start-offset), to=Math.min(s.announced,upper-offset);
      if (from<=to) {
        const members=s.episodes.filter(e=>e.aired===true && e.number>=from && e.number<=to);
        if (members.some(e=>!Number.isInteger(e.id) || e.id<=0)) throw new Error("Refresh season details before recording this rewatch");
        addAvailable(s.number,from,to);
      }
      offset+=s.announced;
    }
    key=`anilist-cour:${c.id}`;
  } else if (scope.kind === "EPISODES") {
    if (!scope.ranges?.length || scope.ranges.length>100) throw new Error("Choose explicit episode ranges");
    scope.ranges.forEach(r => add(r.season,r.from,r.to));
  } else throw new Error("Explicit rewatch scope required");
  if (!ranges.length) throw new Error("No known available coverage");
  return { ...assertion("REWATCH",date,ranges,!!(request.replaces || request.legacyId)), scope_kind: scope.kind, scope_key: key,
    scope_confidence: "CONFIRMED", ...(request.replaces ? { supersedes_id: request.replaces } : {}) };
}
export function parseEpisodeRanges(input: string): NonNullable<RewatchScope["ranges"]> {
  return input.split(",").map(part => {
    const match=/^\s*S?(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/i.exec(part);
    if (!match) throw new Error("Use S1:4-8, S2:1-3");
    return { season: Number(match[1]), from: Number(match[2]), to: Number(match[3] ?? match[2]) };
  });
}
