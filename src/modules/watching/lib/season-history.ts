import type { AnimeCour } from "../types";
import type { MediaView } from "./media-view";
import type { HistoricalViewing, RatingScope } from "./history-analytics";

export interface SeasonPart {
  id: number; number: number; title: string; scopeNumber: number;
  from: number; to: number; flatFrom: number; flatTo: number;
}

/** Accepted provider grouping only. Gaps in airing dates never create a part.
 * Keep TMDB seasons/episode coordinates intact; ambiguous boundaries fall back to episodes. */
export function seasonParts(sizes: readonly number[], cours: readonly AnimeCour[]): Map<number,SeasonPart[]> {
  const out=new Map<number,SeasonPart[]>();
  if(!sizes.length || sizes.some(n=>!Number.isInteger(n) || n<0) || !cours.length) return out;
  let cursor=1;
  const ids=new Set<number>();
  for(const [index,c] of cours.entries()) {
    if(!Number.isInteger(c.anilist_id) || c.anilist_id<=0 || ids.has(c.anilist_id) || c.season!==index+1 ||
      !Number.isInteger(c.episodes) || !c.episodes || c.episodes<1 || c.start_episode!==cursor || c.end_episode!==cursor+c.episodes-1) return new Map();
    ids.add(c.anilist_id);cursor=c.end_episode+1;
  }
  if(cursor-1!==sizes.reduce((sum,n)=>sum+n,0)) return out;
  let offset=0;
  for(const [index,size] of sizes.entries()) {
    // A trailing zero announcement adds no membership and cannot erase known old parts.
    if(size===0) {if(sizes.slice(index+1).some(n=>n>0)) return new Map();continue;}
    const members=cours.filter(c=>c.start_episode>offset && c.end_episode!<=offset+size);
    // A part spanning two TMDB seasons is not a safe nested grouping.
    if(!members.length || members[0].start_episode!==offset+1 || members.at(-1)!.end_episode!==offset+size) return new Map();
    out.set(index+1,members.map((c,i)=>({id:c.anilist_id,number:i+1,title:c.title,scopeNumber:c.season,
      from:c.start_episode-offset,to:c.end_episode!-offset,flatFrom:c.start_episode,flatTo:c.end_episode!})));
    offset+=size;
  }
  return out;
}

/** First viewing may span years; a title completion dates only its terminal season.
 * Neither a rewatch, recording timestamp nor release date changes the first-view period. */
export function seasonViewingPeriods(view:MediaView,records:readonly HistoricalViewing[]):Record<string,string> {
  const years=new Map<number,Set<number>>();
  const add=(s:number,y:number)=>{if(!Number.isInteger(y) || y<1 || !view.seasons[s-1]) return;
    const set=years.get(s) ?? new Set<number>();set.add(y);years.set(s,set);};
  for(const [s,y] of Object.entries(view.yearMap ?? {})) add(Number(s),y);
  for(const r of records) {
    if(r.retracted_at || r.kind==="REWATCH" || r.year==null || r.date_confidence!=="CONFIRMED") continue;
    const ranges=r.kind==="COMPLETION" ? [...r.ranges].sort((a,b)=>a.season_number_at_recording-b.season_number_at_recording || a.episode_to-b.episode_to).slice(-1):r.ranges;
    for(const range of ranges) {
      for(let ep=range.episode_from;ep<=range.episode_to;ep++) add(view.fromStorage(range.season_number_at_recording,ep).season,r.year);
    }
  }
  return Object.fromEntries([...years].map(([s,ys])=>{
    const first=Math.min(...ys),last=Math.max(...ys);return [String(s),first===last ? String(first):`${first} – ${last}`];
  }));
}

/** Exact, evidenced period coverage only. Legacy aggregate counts cannot prove an episode interval. */
export function periodEpisodeLabel(view:MediaView,season:number,records:readonly HistoricalViewing[]):string|null {
  const episodes=new Set<number>();
  for(const r of records) {
    if(r.kind!=="FIRST_WATCH" || r.retracted_at || !r.ranges.length) return null;
    for(const range of r.ranges) for(let ep=range.episode_from;ep<=range.episode_to;ep++) {
      const position=view.fromStorage(range.season_number_at_recording,ep);
      if(position.season!==season) return null;
      episodes.add(position.episode);
    }
  }
  if(!episodes.size) return null;
  const sorted=[...episodes].sort((a,b)=>a-b),first=sorted[0],last=sorted.at(-1)!;
  if(first===1 && last===view.seasons[season-1]?.aired && episodes.size===last) return null;
  if(episodes.size!==last-first+1) return `${episodes.size} episodes`;
  const part=view.seasons[season-1]?.parts?.find(p=>p.from===first && p.to===last);
  const label=first===last ? `EP${first}`:`EP${first}–${last}`;
  return part ? `Part ${part.number} · ${label}`:label;
}


/** Compact identifiers, not a count of seasons touched by progress. */
function ordinalRanges(values:number[],prefix:string):string {
  const sorted=[...new Set(values)].sort((a,b)=>a-b),groups:string[]=[];
  for(let i=0;i<sorted.length;i++) {
    const first=sorted[i];let last=first;
    while(sorted[i+1]===last+1)last=sorted[++i];
    groups.push(first===last ? `${prefix}${first}`:`${prefix}${first}–${prefix}${last}`);
  }
  return groups.join(", ");
}

/** Only the subjects that actually supplied the annual score own its label and poster. */
export function ratedScopePresentation(view:MediaView,scopes:readonly RatingScope[]):{seasonLabel:string|null;seasonPoster:string|null} {
  const subjects=new Map<number,{whole:boolean;parts:number[]}>();
  for(const scope of scopes) {
    let season:number|undefined,part:number|undefined;
    if(view.overlaid && scope.kind==="COUR") {
      season=scope.scopeKey ? view.cours?.find(c=>`anilist-cour:${c.anilist_id}`===scope.scopeKey)?.season:scope.number;
    } else if(!view.overlaid && scope.kind==="SEASON")season=scope.number;
    else if(!view.overlaid && scope.kind==="COUR" && scope.scopeKey) {
      const parent=view.seasons.find(s=>s.parts?.some(p=>`anilist-cour:${p.id}`===scope.scopeKey));
      season=parent?.season;part=parent?.parts?.find(p=>`anilist-cour:${p.id}`===scope.scopeKey)?.number;
    }
    if(season==null || !view.seasons[season-1])continue;
    const subject=subjects.get(season) ?? {whole:false,parts:[]};
    if(part==null)subject.whole=true;else subject.parts.push(part);
    subjects.set(season,subject);
  }
  const entries=[...subjects].sort(([a],[b])=>a-b);
  if(!entries.length)return {seasonLabel:null,seasonPoster:null};
  const whole=entries.filter(([,s])=>s.whole).map(([s])=>s);
  const labels=whole.length ? [ordinalRanges(whole,"S")]:[];
  for(const [season,subject]of entries)if(!subject.whole && subject.parts.length)
    labels.push(`S${season} · ${new Set(subject.parts).size===1 ? "Part":"Parts"} ${ordinalRanges(subject.parts,"")}`);
  const poster=entries.length===1 ? view.seasons[entries[0][0]-1].poster:null;
  return {seasonLabel:labels.join(" · "),seasonPoster:poster ? poster.startsWith("http") ? poster:`https://image.tmdb.org/t/p/w500${poster}`:null};
}
