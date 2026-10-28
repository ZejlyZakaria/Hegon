import {describe,it,expect} from "vitest";
import {periodEpisodeLabel,ratedScopePresentation,seasonParts,seasonViewingPeriods} from "./season-history";
import {buildMediaView} from "./media-view";
import {partDisplayScore,partMatchesView,scopeDisplayScores,type ScopeRatingContext} from "./scope-ratings";
import {assertion,viewingDate,type ViewingRange} from "./viewing-history";
import type {HistoricalViewing} from "./history-analytics";
import type {AnimeCour} from "../types";

const counts=[366,13,13,14,10];
let offset=0;
const cours:AnimeCour[]=counts.map((episodes,i)=>{const start=offset+1;offset+=episodes;
  return {season:i+1,anilist_id:100+i,title:`Part ${i}`,poster_url:null,year:2020+i,end_year:2020+i,
    episodes,start_episode:start,end_episode:offset};});
const media={type:"anime" as const,season_episodes:[366,50],season_aired:[366,50],current_season:2,current_episode:50,
  season_years:{1:2020,2:2023}};
const view=buildMediaView(media,{tmdb_id:30984,source:"anilist",cours});
const range=(s:number,from:number,to:number):ViewingRange=>({season_key:`tmdb-season:${s}`,season_number_at_recording:s,
  episode_from:from,episode_to:to,episode_ids:null,minutes:24*(to-from+1),duration_basis:"RUNTIME_SNAPSHOT"});
const record=(id:string,s:number,from:number,to:number,year:number,kind:HistoricalViewing["kind"]="FIRST_WATCH"):HistoricalViewing=>({
  ...assertion(kind,viewingDate({year,month:null,day:null}),[range(s,from,to)]),id,media_item_id:"bleach",work_key:"tv:30984",
  title_snapshot:"Bleach",media_type_snapshot:"anime",recorded_at:"2026-10-28",retracted_at:null});

describe("Nested anime parts keep storage seasons stable",()=>{
  it("maps four TYBW parts into S2 without recutting S1 or changing legacy maps",()=>{
    expect(view.overlaid).toBe(false);expect(view.toStorage(2,50)).toEqual({season:2,episode:50});
    expect(view.seasons[1].parts?.map(p=>[p.number,p.from,p.to])).toEqual([[1,1,13],[2,14,26],[3,27,40],[4,41,50]]);
    expect(view.yearMap).toEqual({1:2020,2:2023});
    expect(view.seasons[0].parts).toHaveLength(1);
    expect(seasonParts([366,50,0],cours).get(2)).toEqual(view.seasons[1].parts);
  });
  it("degrades to plain episodes for mismatched totals, unknown counts, gaps, duplicate IDs and crossing boundaries",()=>{
    for(const sizes of [[366,49],[365,51],[0,416]]) expect(seasonParts(sizes,cours).size).toBe(0);
    for(const change of [{episodes:null,end_episode:null},{start_episode:999},{anilist_id:100},{season:999}]) {
      const broken=cours.map((c,i)=>i===1 ? {...c,...change}:c);
      expect(seasonParts([366,50],broken).size).toBe(0);
    }
  });
  it("does not infer parts from episode airing gaps or turn series into anime",()=>{
    const plain=buildMediaView({...media,type:"serie"},null);
    expect(plain.seasons[1].parts).toBeUndefined();
    expect(buildMediaView(media,{tmdb_id:30984,source:"mismatch",cours}).seasons[1].parts).toBeUndefined();
  });
});

describe("Season history periods",()=>{
  it("extends only S2 to2026 and ignores rewatches, tombstones and unconfirmed dates",()=>{
    const retracted={...record("removed",1,1,1,2025),retracted_at:"2026-10-28"};
    const inferred={...record("inferred",1,2,2,2024),date_confidence:"INFERRED" as const};
    const events=[record("49",2,49,49,2026),record("50",2,50,50,2026),record("rw",1,1,366,2027,"REWATCH"),retracted,inferred];
    expect(seasonViewingPeriods(view,events)).toEqual({1:"2020",2:"2023 – 2026"});
    expect(media.season_years).toEqual({1:2020,2:2023});
  });
  it("a full-title completion never redates all prior seasons",()=>{
    const completion={...record("finish",2,1,50,2026,"COMPLETION"),ranges:[range(1,1,366),range(2,1,50)]};
    expect(seasonViewingPeriods(view,[completion])).toEqual({1:"2020",2:"2023 – 2026"});
  });
  it("a December/January season spans both viewing years, including an existing single-season anime overlay",()=>{
    const plain=buildMediaView({type:"serie",season_episodes:[20],season_aired:[20]},null);
    expect(seasonViewingPeriods(plain,[record("dec",1,1,10,2026),record("jan",1,11,20,2027)])).toEqual({1:"2026 – 2027"});
    const overlaid=buildMediaView({type:"anime",season_episodes:[416],season_aired:[416]}, {tmdb_id:30984,source:"anilist",cours});
    expect(seasonViewingPeriods(overlaid,[record("last",1,416,416,2026)])).toEqual({5:"2026"});
  });
});

describe("Frozen opinions after season growth",()=>{
  const context:ScopeRatingContext={kind:"SEASON",number:2,scope_key:"tmdb-season:22",score:9,rating_id:"old",
    validity:"NEEDS_RECONFIRMATION",covered_episodes:13,available_episodes:50,range_start:1,range_end:null,
    provider_snapshot_id:"provider",mapping_snapshot_id:null};
  it("hides proven growth while retaining current and unverified saved opinions",()=>{
    expect(scopeDisplayScores([context],view)).toEqual({});expect(context.score).toBe(9);
    expect(scopeDisplayScores([{...context,validity:"CURRENT",covered_episodes:50}],view)).toEqual({2:9});
    expect(scopeDisplayScores([{...context,validity:"SCOPE_UNVERIFIED"}],view)).toEqual({2:9});
  });
  it("an old part remains independently rateable after another part arrives; remapping refuses the old context",()=>{
    const part=view.seasons[1].parts![0];
    const c:ScopeRatingContext={...context,kind:"COUR",number:part.scopeNumber,scope_key:`anilist-cour:${part.id}`,
      validity:"CURRENT",available_episodes:13,range_start:part.flatFrom,range_end:part.flatTo};
    expect(partMatchesView(c,view,part)).toBe(true);
    expect(partDisplayScore({...c,validity:"SCOPE_UNVERIFIED",available_episodes:null},view,part)).toBe(9);
    expect(partMatchesView({...c,available_episodes:null},view,part)).toBe(false);
    expect(partDisplayScore({...c,available_episodes:12},view,part)).toBeNull();
    expect(partDisplayScore({...c,validity:"NEEDS_RECONFIRMATION"},view,part)).toBeNull();
    expect(partMatchesView({...c,range_end:part.flatTo+1},view,part)).toBe(false);
    expect(partMatchesView({...c,scope_key:"anilist-cour:999"},view,part)).toBe(false);
    expect(partMatchesView(c,{...view,pending:true},part)).toBe(false);
  });
});

describe("Period episode presentation",()=>{
  it("names an exact verified part, shows sparse episode counts and avoids claiming complete seasons are partial",()=>{
    expect(periodEpisodeLabel(view,2,[record("part",2,14,26,2023)])).toBe("Part 2 · EP14–26");
    expect(periodEpisodeLabel(view,2,[record("one",2,49,49,2026)])).toBe("EP49");
    expect(periodEpisodeLabel(view,2,[record("one",2,1,1,2026),record("three",2,3,3,2026)])).toBe("2 episodes");
    expect(periodEpisodeLabel(view,2,[record("full",2,1,50,2026)])).toBeNull();
    expect(periodEpisodeLabel(view,2,[record("rewatch",2,14,26,2026,"REWATCH")])).toBeNull();
  });
});


describe("Top Picks labels describe scored subjects",()=>{
  const series=buildMediaView({type:"serie",season_episodes:[13,13,13],season_aired:[13,13,13],season_posters:["/s1.jpg","/s2.jpg","/s3.jpg"]},null);
  it("uses identifiers for contiguous and separate rated seasons, never a count",()=>{
    expect(ratedScopePresentation(series,[{kind:"SEASON",number:1},{kind:"SEASON",number:2}])).toEqual({seasonLabel:"S1–S2",seasonPoster:null});
    expect(ratedScopePresentation(series,[{kind:"SEASON",number:1},{kind:"SEASON",number:3}]).seasonLabel).toBe("S1, S3");
    expect(ratedScopePresentation(series,[{kind:"SEASON",number:3}])).toEqual({seasonLabel:"S3",seasonPoster:"https://image.tmdb.org/t/p/w500/s3.jpg"});
    expect(ratedScopePresentation(series,[])).toEqual({seasonLabel:null,seasonPoster:null});
  });
  it("names an independently scored nested part and refuses a missing identity",()=>{
    expect(ratedScopePresentation(view,[{kind:"COUR",number:5,scopeKey:"anilist-cour:104"}]).seasonLabel).toBe("S2 · Part 4");
    expect(ratedScopePresentation(view,[{kind:"COUR",number:5,scopeKey:"anilist-cour:999"}]).seasonLabel).toBeNull();
    expect(ratedScopePresentation(view,[{kind:"SEASON",number:2}]).seasonLabel).toBe("S2");
  });
});
