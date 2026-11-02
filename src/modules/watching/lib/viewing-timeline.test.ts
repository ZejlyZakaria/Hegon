import {buildMediaView} from "./media-view";
import {describe,expect,it} from "vitest";
import {viewingMetrics,buildViewingSummary,viewingPanelLabel,timelineDate,timelineDuration} from "./viewing-timeline";
import {assertion,viewingDate,type ViewingRange} from "./viewing-history";
import type {HistoricalViewing} from "./history-analytics";
import type {WatchingMedia,Rewatch,AnimeCour} from "../types";
import {rewatchWithinCoverage} from "./rewatch";

const media=(overrides:Partial<WatchingMedia>={})=>({id:"title",tmdb_id:42,title:"Fixture",type:"anime",watched:true,in_progress:false,paused:false,dropped:false,
  watched_at:null,viewing_date:null,runtime:24,season_episodes:[366,50],season_aired:[366,50],season_years:{1:2020,2:2023},current_season:2,current_episode:50,...overrides} as WatchingMedia);
const range=(season:number,from:number,to:number,minutes:number|null=(to-from+1)*24):ViewingRange=>({season_key:`season:${season}`,season_number_at_recording:season,episode_from:from,episode_to:to,episode_ids:null,minutes,duration_basis:minutes==null ? "UNKNOWN":"RUNTIME_SNAPSHOT"});
const date=(year:number,month:number|null=null,day:number|null=null)=>viewingDate({year,month,day});
const record=(id:string,kind:HistoricalViewing["kind"],ranges:ViewingRange[],when=viewingDate(),extra:Partial<HistoricalViewing>={}):HistoricalViewing=>({
  ...assertion(kind,when,ranges),id,media_item_id:"title",work_key:"tv:42",title_snapshot:"Fixture",media_type_snapshot:"anime",recorded_at:`2026-10-28T12:00:${id.padStart(2,"0")}Z`,retracted_at:null,...extra});
const cours=[366,13,13,14,10].map((episodes,i,all)=>({season:i+1,anilist_id:i+1,title:`Part${i}`,episodes,
  start_episode:1+all.slice(0,i).reduce((n,v)=>n+v,0),end_episode:all.slice(0,i+1).reduce((n,v)=>n+v,0),poster_url:null,year:2020,end_year:2026})) as AnimeCour[];
const lens=(m:WatchingMedia)=>buildMediaView(m,{tmdb_id:42,source:"anilist",cours});

describe("contextual viewing summary",()=>{
  it("combines the three Bleach consumption chunks into Part4, keeps S1 and never assigns S2's legacy year to all parts",()=>{
    const m=media();const view=lens(m);
    const events=[record("1","FIRST_WATCH",[range(2,41,48)],date(2026)),record("2","FIRST_WATCH",[range(2,49,49)],date(2026,10,20)),record("3","FIRST_WATCH",[range(2,50,50)],date(2026,10,28)),
      ...[4,5,6].map(id=>record(String(id),"COMPLETION",[range(2,1,50)],viewingDate(),{completion_basis:"AVAILABLE_SCOPE"}))];
    const before=JSON.stringify([m,events]);const result=buildViewingSummary(m,events,[],view);
    expect(result.first?.minutes).toBe(416*24);expect(result.first?.episodes).toBe(416);
    expect(result.first?.children[0]).toMatchObject({label:"Season 1",period:"2020",minutes:366*24});
    const parts=result.first!.children[1].children;
    expect(parts).toHaveLength(4);expect(parts[3]).toMatchObject({label:"Part 4 · EP41–50",period:"2026",minutes:240,episodes:10});
    expect(parts.slice(0,3).every(p=>p.period==="Date to confirm")).toBe(true);
    expect(parts.reduce((n,p)=>n+(p.minutes ?? 0),0)).toBe(50*24);
    expect(viewingPanelLabel(result)).toBe("Viewing details");expect(JSON.stringify([m,events])).toBe(before);
  });
  it("never counts completion milestones again or revives retracted legacy coverage",()=>{
    const m=media({season_episodes:[12],season_aired:[12],season_years:{1:2020}});
    const events=[record("1","FIRST_WATCH",[range(1,1,6)],date(2020)),record("2","FIRST_WATCH",[range(1,7,12)],date(2020),{retracted_at:"2026-10-29"}),record("3","COMPLETION",[range(1,1,12)],date(2020))];
    const result=buildViewingSummary(m,events);
    expect(result.first).toMatchObject({episodes:6,minutes:144});expect(viewingPanelLabel(result)).toBeNull();
  });
  it("a film has one first viewing, no Season0 and no redundant history entry point",()=>{
    const m=media({type:"film",season_episodes:null,season_aired:null});
    const result=buildViewingSummary(m,[record("1","FIRST_WATCH",[range(0,1,1,156)],date(2026,10,30),{work_key:"movie:42"}),record("2","COMPLETION",[range(0,1,1)],date(2026),{work_key:"movie:42"})]);
    expect(result.first).toMatchObject({period:"30 Oct 2026",minutes:156,children:[]});expect(viewingPanelLabel(result)).toBeNull();
    expect(timelineDuration(156)).toBe("2h 36m");
  });
  it("does not invent a canonical film date from its registration/projection",()=>{
    const result=buildViewingSummary(media({type:"film",watched_at:"2026-10-29"}),[record("1","FIRST_WATCH",[range(0,1,1,156)],viewingDate(),{work_key:"movie:42"})]);
    expect(result.first?.period).toBe("Date to confirm");
  });
  it("keeps four separate frozen GOT rewatches and a single first-view summary",()=>{
    const m=media({type:"serie",season_episodes:[10,10,10,10,10,10,7,6],season_aired:[10,10,10,10,10,10,7,6],season_years:{},watched_at:null});
    const ranges=[3,2,1,6,7,8,5,4].map(s=>range(s,1,s===8?6:s===7?7:10,s===1?4232:0));
    const events=[2021,2024,2022,2023].map((y,i)=>record(String(i+1),"REWATCH",ranges,date(y,3,22),{scope_kind:"WHOLE_TITLE"}));
    const result=buildViewingSummary(m,events);
    expect(result.rewatches.map(e=>e.date.year)).toEqual([2024,2023,2022,2021]);
    expect(result.rewatches.every(e=>e.scope==="Entire series" && e.minutes===4232)).toBe(true);
    expect(result.first?.period).toBe("Date to confirm");expect(viewingPanelLabel(result)).toBe("Viewing history");
    expect(timelineDuration(4232)).toBe("70h 32m");
  });
  it("does not offer history for an unconsumed title or restore a removed rewatch",()=>{
    const removed=record("1","REWATCH",[range(1,1,12)],viewingDate(),{retracted_at:"2026-10-29"});
    const result=buildViewingSummary(media({watched:false,current_season:1,current_episode:0}),[removed],[{id:"1",watched_on:"2024-03-22"} as Rewatch]);
    expect(result.first).toBeNull();expect(result.rewatches).toEqual([]);expect(viewingPanelLabel(result)).toBeNull();
  });
  it("keeps unknown hours unknown when a frozen canonical aggregate straddles parts",()=>{
    const m=media();const result=buildViewingSummary(m,[record("1","FIRST_WATCH",[range(2,1,50,1200)],date(2023))],[],lens(m));
    expect(result.first?.children[1].minutes).toBe(1200);
    expect(result.first?.children[1].children.every(p=>p.minutes==null && p.unknownDuration)).toBe(true);
  });
  it("keeps anime ranges in the existing overlay lens",()=>{
    const m=media({season_episodes:[47],season_aired:[47],season_years:null,cour_years:{1:2020,2:2026}});
    const cours=[24,23].map((episodes,i)=>({season:i+1,anilist_id:i+1,title:"Season",episodes,start_episode:i?25:1,end_episode:i?47:24,poster_url:null,year:2020,end_year:2026}));
    const view=buildMediaView(m,{tmdb_id:42,source:"anilist",cours});
    const result=buildViewingSummary(m,[record("1","FIRST_WATCH",[range(1,25,47)],date(2026))],[],view);
    expect(result.first?.children[1]).toMatchObject({label:"Season 2",episodes:23,period:"2026"});
    expect(timelineDate(date(2026,10,30))).toBe("30 Oct 2026");
  });
  it("does not present partial known dates as the date of an entire part",()=>{
    const m=media();const result=buildViewingSummary(m,[record("1","FIRST_WATCH",[range(2,49,50)],date(2026))],[],lens(m));
    expect(result.first!.children[1].children[3]).toMatchObject({minutes:240,period:"2026 · dates incomplete"});
  });
  it("completion fallback exposes only uncovered membership and no invented duration",()=>{
    const m=media({season_episodes:[12],season_aired:[12],season_years:{1:2020},legacy_consumption:{version:1,captured_at:"2026-01-01",counts:[6],runtime:24,fallback_year:2020,completed:false}});
    const result=buildViewingSummary(m,[record("1","COMPLETION",[range(1,1,12)],date(2020))]);
    expect(result.first).toMatchObject({episodes:12,minutes:144,unknownDuration:true});
    expect(result.firstCoverage.reduce((n,r)=>n+r.episode_to-r.episode_from+1,0)).toBe(12);
  });
  it("an independent rewatch survives without inventing first-view consumption",()=>{
    const result=buildViewingSummary(media({watched:false,current_season:1,current_episode:0}),[record("1","REWATCH",[range(1,1,12)],date(2024))]);
    expect(result.first).toBeNull();expect(result.rewatches).toHaveLength(1);expect(viewingPanelLabel(result)).toBe("Viewing history");
  });
  it("rewatch membership permits consumed seasons, not a full title with unseen episodes",()=>{
    const first=[range(1,1,6),range(1,7,12)];
    expect(rewatchWithinCoverage([range(1,1,12)],first)).toBe(true);
    expect(rewatchWithinCoverage([range(1,1,12),range(2,1,10)],first)).toBe(false);
    expect(rewatchWithinCoverage([range(1,1,12)],[range(1,1,5),range(1,7,12)])).toBe(false);
    expect(rewatchWithinCoverage([range(1,1,12)],[])).toBe(false);
  });
  it("only shows consumed nested parts, including a single watched part of an ongoing season",()=>{
    const m=media({watched:false,in_progress:true,current_season:2,current_episode:13,season_years:{1:2020,2:2026}});
    const result=buildViewingSummary(m,[],[],lens(m));
    expect(result.first!.children[1].children.map(p=>p.label)).toEqual(["Part 1 · EP1–13"]);
    expect(viewingPanelLabel(result)).toBe("Viewing details");
  });
});


describe("personal quick totals", () => {
  it("uses frozen rewatch duration even when today's catalogue grows", () => {
    const m=media({season_aired:[6],season_episodes:[6],season_years:{1:2020},current_season:1,current_episode:6});
    const events=[record("1","FIRST_WATCH",[range(1,1,6,180)],date(2020)), record("2","REWATCH",[range(1,1,3,75)],date(2021))];
    const before=JSON.stringify(events);
    const totals=viewingMetrics(buildViewingSummary(m,events));
    expect(totals).toEqual({episodes:6,minutes:255,incomplete:false});
    expect(viewingMetrics(buildViewingSummary({...m,runtime:100},events))).toEqual(totals);
    expect(JSON.stringify(events)).toBe(before);
  });
  it("keeps an unknown-duration rewatch visible without multiplying today's runtime", () => {
    const m=media({season_aired:[6],season_episodes:[6],season_years:{1:2020},current_season:1,current_episode:6});
    const events=[record("1","FIRST_WATCH",[range(1,1,6,180)],date(2020)),record("2","REWATCH",[range(1,1,6,null)],date(2022))];
    expect(viewingMetrics(buildViewingSummary(m,events))).toEqual({episodes:6,minutes:180,incomplete:true});
  });
});
