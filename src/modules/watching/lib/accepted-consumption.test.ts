import { describe,it,expect } from "vitest";
import { computeStats } from "../components/stats/computeStats";
import { computeWatchingAchievements } from "../components/stats/achievements";
import { receiptMetrics,withUnlockReceipts,type ReceiptSnapshot } from "./milestone-receipts";
import { assertion,viewingDate } from "./viewing-history";
import { tmdbPosterSrcSet } from "./tmdb-image";
import type { StatsRawItem } from "../service";

const item=(override:Partial<StatsRawItem>={}):StatsRawItem=>({
  id:"black-clover",tmdb_id:73223,type:"anime",title:"Black Clover",watched:false,in_progress:true,
  current_season:2,current_episode:3,runtime:24,season_episodes:[170,12],season_aired:[170,3],
  season_years:{"1":2022},season_ratings:{"1":8.5},user_rating:8.5,updated_at:"2026-10-18",
  season_posters:["/s1.jpg","/s2.jpg"],poster_url:"/global.jpg",...override} as StatsRawItem);
function snapshot(items=[item()]):ReceiptSnapshot {
  return {items,history:{records:[],ratings:[]},rewatches:[],cours:[],source_hash:"offline",measured_at:"2026-10-22"};
}
function record(kind:"FIRST_WATCH"|"REWATCH"|"COMPLETION",season:number,year:number,month:number) {
  return {...assertion(kind,viewingDate({year,month,day:1}),[
    {season_key:`tmdb-season:${season}`,season_number_at_recording:season,episode_from:1,episode_to:3,
      episode_ids:null,minutes:72,duration_basis:"RUNTIME_SNAPSHOT"}]),
    id:`${kind}:${season}:${year}`,media_item_id:"black-clover",work_key:"tv:73223",title_snapshot:"Black Clover",
    media_type_snapshot:"anime",recorded_at:"2026-10-18",retracted_at:null};
}
const stats=(s:ReceiptSnapshot,year:number|null=null)=>computeStats(s.items,s.rewatches,year,new Map(),s.history);
describe("Accepted legacy, frozen scope and annual presentation",()=>{
  it("uses S1 in2022 and history-only S2 in2026 without leaking the old rating",()=>{
    const s=snapshot();s.history.records=[record("FIRST_WATCH",2,2026,10)];
    const old=stats(s,2022),now=stats(s,2026);
    expect(old.hours.total).toBe(68);
    expect(old.topFavorites[0]).toMatchObject({rating:8.5,seasonLabel:"S1",seasonPoster:"https://image.tmdb.org/t/p/w500/s1.jpg"});
    expect(now.breakdown.anime[0]).toMatchObject({seasonLabel:"Season 2",seasonPoster:"https://image.tmdb.org/t/p/w500/s2.jpg"});
    expect(now.ratedCount).toBe(0);expect(now.topFavorites).toHaveLength(0);
  });
  it("falls back to the global poster when legacy and history cover two seasons in one year",()=>{
    const s=snapshot([item({season_years:{"1":2026}})]);s.history.records=[record("FIRST_WATCH",2,2026,10)];
    expect(stats(s,2026).breakdown.anime[0]).toMatchObject({seasonLabel:"2 seasons",seasonPoster:null});
  });
  it("freezes old hours across runtime/episode growth and keeps canonical rewatches separate",()=>{
    const s=snapshot([item({legacy_consumption:{version:1,captured_at:"2026-10-22",counts:[170,3],runtime:24,fallback_year:2026,completed:false}})]);
    s.history.records=[record("FIRST_WATCH",2,2026,10),record("REWATCH",1,2023,6)];
    const before=stats(s);expect(stats(s,2022).hours.total).toBe(68);
    s.items[0]={...s.items[0],runtime:48,season_aired:[170,30,12],season_episodes:[170,30,12],updated_at:"2027-01-01"};
    expect(stats(s,2022).hours.total).toBe(68);expect(stats(s).hours).toEqual(before.hours);
    expect(stats(s,2023).hours.rewatches).toBe(1.2);
    expect(stats(s,2026).hours.anime).toBe(1.2); // canonical S2 replaces baseline, never doubles it
  });
  it("keeps a lumped anime's accepted cour hours and poster when another cour is announced",()=>{
    const s=snapshot([item({watched:true,in_progress:false,current_season:1,current_episode:24,
      season_aired:[24],season_episodes:[24],cour_years:{"1":2021},season_years:{},
      legacy_consumption:{version:1,captured_at:"2026-10-22",counts:[24],runtime:24,fallback_year:2021,completed:true,storage_sizes:[24]}})]);
    const cour=(number:number,start:number,end:number)=>({season:number,anilist_id:100+number,title:`Cour ${number}`,
      start_episode:start,end_episode:end,episodes:end-start+1,year:2021,end_year:2021,poster_url:`https://anilist.co/${number}.jpg`});
    const row={tmdb_id:73223,source:"anilist",cours:[cour(1,1,24),cour(2,25,36)],updated_at:"2026-10-22"} as const;
    const cours=new Map([[73223,{...row,cours:[...row.cours]}]]);
    const before=computeStats(s.items,[],2021,cours,s.history);
    s.items[0]={...s.items[0],season_aired:[36],season_episodes:[48],runtime:48};
    const after=computeStats(s.items,[],2021,cours,s.history);
    expect(after.hours).toEqual(before.hours);expect(after.hours.anime).toBe(9.6);
    expect(after.breakdown.anime[0]).toMatchObject({seasonLabel:"Season 1",seasonPoster:"https://anilist.co/1.jpg"});
  });
  it("does not label an unrated favorite with the cour it only consumed",()=>{
    const s=snapshot([item({in_progress:false,season_aired:[36],season_episodes:[36]})]);
    s.history.records=[{...record("FIRST_WATCH",1,2023,6),scope_kind:"COUR",scope_key:"anilist-cour:102"}];
    const cours=new Map([[73223,{tmdb_id:73223,source:"anilist" as const,cours:[
      {season:1,anilist_id:101,title:"Cour1",episodes:24,start_episode:1,end_episode:24,year:2021,end_year:2021,poster_url:"https://anilist.co/1.jpg"},
      {season:2,anilist_id:102,title:"Cour2",episodes:12,start_episode:25,end_episode:36,year:2023,end_year:2023,poster_url:"https://anilist.co/2.jpg"}],updated_at:"2026-10-22"}]]);
    s.items[0].favorite=true;
    const pick=computeStats(s.items,[],2023,cours,s.history).topFavorites[0];
    expect(pick).toMatchObject({rating:null,seasonLabel:null,seasonPoster:null});
  });
  it("keeps Hannibal annual mean at8.75",()=>{
    const s=snapshot([item({title:"Hannibal",type:"serie",watched:true,in_progress:false,season_aired:[13,13],season_episodes:[13,13],season_years:{"1":2026,"2":2026},season_ratings:{"1":8.5,"2":9}})]);
    expect(stats(s,2026).topFavorites[0].rating).toBe(8.75);
  });
});
describe("One achievement metric for UI, explanation and server eligibility",()=>{
  it("uses all accepted activity months, including legacy, partial history and rewatches",()=>{
    const s=snapshot([item({watched_at:"2022-02-01"})]);
    s.history.records=[record("FIRST_WATCH",2,2026,10),record("REWATCH",1,2023,6)];
    const all=stats(s),display=computeWatchingAchievements(s.items,all.hours.total,[...all.breakdown.anime],all.breakdown.rewatches,{stats:all,history:s.history});
    const month=display.find(a=>a.key==="ever_present")!;
    expect(month.detail.value).toBe(3);expect(month.detail.groups.map(g=>g.label)).toEqual(["2026-10","2023-06","2022-02"]);
    const server=receiptMetrics(s).achievements;
    for(const a of display.filter(a=>!["connoisseur","hall_of_fame"].includes(a.key)))
      expect(server.find(r=>r.achievement_key===a.key)?.actual_value).toBe(a.detail.value);
  });
  it("retains a finished500episode legacy scope after a new season reopens the show",()=>{
    const s=snapshot([item({season_aired:[500,10],season_episodes:[500,10],current_episode:1,
      legacy_consumption:{version:1,captured_at:"2026-10-22",counts:[500],runtime:24,fallback_year:2022,completed:true}})]);
    const value=()=>receiptMetrics(s).achievements.find(r=>r.achievement_key==="long_hauler")!.actual_value;
    expect(value()).toBe(500);s.items[0].season_aired=[999,100];expect(value()).toBe(500);
    expect(receiptMetrics(s).goalValue("anime",null)).toBe(0); // Goal policy unchanged
  });
  it("does not call a partial100episode show finished",()=>{
    const s=snapshot([item({season_aired:[500],current_season:1,current_episode:100})]);
    expect(receiptMetrics(s).achievements.find(r=>r.achievement_key==="long_hauler")!.actual_value).toBe(0);
  });
  it("never manufactures a permanent unlock date from accepted legacy dates",()=>{
    const s=snapshot([item({watched:true,in_progress:false,season_aired:[500],season_episodes:[500]})]),all=stats(s);
    const a=withUnlockReceipts(computeWatchingAchievements(s.items,all.hours.total,[],[],{stats:all,history:s.history}),[]).find(a=>a.key==="long_hauler")!;
    expect(a.detail.value).toBe(500);expect(a.unlocked).toBe(false);expect(a.detail.unlockedAt).toBeNull();
  });
});
describe("Compact poster density",()=>{
  it("selects w92 for1x/2x and w154 for3x without requesting w500",()=>{
    expect(tmdbPosterSrcSet("https://image.tmdb.org/t/p/w500/poster.jpg",40)).toBe(
      "https://image.tmdb.org/t/p/w92/poster.jpg 1x, https://image.tmdb.org/t/p/w92/poster.jpg 2x, https://image.tmdb.org/t/p/w154/poster.jpg 3x");
  });
  it("leaves uploaded and AniList artwork untouched",()=>{
    expect(tmdbPosterSrcSet("https://s4.anilist.co/a.jpg",40)).toBeUndefined();
    expect(tmdbPosterSrcSet("https://hegon.supabase.co/storage/poster.jpg",40)).toBeUndefined();
  });
});
