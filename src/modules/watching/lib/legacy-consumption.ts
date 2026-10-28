import { flatEpisode, flatToCour, courToFlat, tmdbFromFlat } from "./anime-overlay";
import type { StatsRawItem } from "../service";
import type { MediaView } from "./media-view";

/** An accepted estimate, not a confirmed viewing assertion or provider catalogue. */
export interface LegacyConsumption {
  version:1; captured_at:string; counts:number[]; runtime:number|null;
  fallback_year:number|null; completed:boolean; storage_sizes?:number[]; calendar_date?:string|null;
}
export const legacyRuntime=(item:StatsRawItem):number|null =>
  item.legacy_consumption ? item.legacy_consumption.runtime : item.runtime;

/** Preserve the storage offsets used by legacy coverage when provider season lengths change. */
export function legacyCoordinates(item:StatsRawItem,view:MediaView) {
  const sizes=item.legacy_consumption?.storage_sizes;
  if(!sizes || !view.overlaid || !view.cours) return view;
  const cours=view.cours;
  return {
    fromStorage:(season:number,episode:number)=>flatToCour(flatEpisode(sizes,season,episode),cours),
    toStorage:(season:number,episode:number)=>tmdbFromFlat(sizes,courToFlat(season,episode,cours)),
  };
}

/** Frozen STORAGE coverage expressed through the current display lens. */
export function legacyDisplayCounts(item:StatsRawItem,view:MediaView):number[]|null {
  if(!item.legacy_consumption) return null;
  const coordinates=legacyCoordinates(item,view);
  const counts:number[]=[];
  item.legacy_consumption.counts.forEach((count,index)=>{
    for(let ep=1;ep<=count;ep++) {
      const position=coordinates.fromStorage(index+1,ep);
      counts[position.season-1]=(counts[position.season-1] ?? 0)+1;
    }
  });
  return Array.from({length:Math.max(view.seasons.length,counts.length)},(_,i)=>counts[i] ?? 0);
}
