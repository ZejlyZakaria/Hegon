import { describe, expect, it } from "vitest";
import { animationStudioCredits, catalogueBroadcastYears, catalogueEpisodes, catalogueReleaseDate, catalogueText } from "./catalogue-facts";
describe("catalogue facts", () => {
  it("separates aired from announced and prefers season evidence to a stale total", () => {
    expect(catalogueEpisodes({season_aired:[6,0],season_episodes:[6,8],episodes:6})).toEqual({aired:6,total:14});
    expect(catalogueEpisodes({season_aired:[6],season_episodes:[6],episodes:100})).toEqual({aired:6,total:6});
    expect(catalogueEpisodes({season_aired:[0],season_episodes:[6]})).toEqual({aired:0,total:6});
    expect(catalogueEpisodes({})).toEqual({aired:null,total:null});
  });
  it("does not present invalid dates or N/A as real catalogue facts", () => {
    expect(catalogueReleaseDate("2026-02-30")).toBeNull();
    expect(catalogueReleaseDate("2026-01-18T00:00:00Z")).toBe("18 Jan 2026");
    expect(catalogueReleaseDate("2026")).toBeNull();
    expect(catalogueText(" N/A ")).toBeNull();
    expect(catalogueText(" HBO ")).toBe("HBO");
  });
});

it("covers Bleach's returning run rather than the original IMDb run only", () => {
  expect(catalogueBroadcastYears({status:"ended",season_aired:[366,50],season_air_dates:["2004-10-05","2022-10-11"],season_end_dates:["2012-03-27","2026-10-27"]},"2004-2012")).toBe("2004\u20132026");
  expect(catalogueBroadcastYears({status:"returning series",season_aired:[6,0],season_air_dates:["2026-01-18","2028-01-01"],season_end_dates:["2026-02-22",null]},"2026")).toBe("2026\u2013present");
  expect(catalogueBroadcastYears({status:"ended",season_aired:[6],season_air_dates:["2026-01-18"],season_end_dates:["2026-02-22"]})).toBe("2026");
  expect(catalogueBroadcastYears({},"N/A")).toBeNull();
});


it("keeps changing animation studios tied to their own AniList entries, never to a network",()=>{
  const row={tmdb_id:1,source:"anilist" as const,cours:[
    {season:1,anilist_id:11,title:"First season",studios:[{id:1,name:"WIT STUDIO"}]},
    {season:2,anilist_id:22,title:"Second season",studios:[{id:2,name:"MAPPA"}]},
  ]} as import("../types").AnimeCoursRow;
  expect(animationStudioCredits(row)).toEqual([{title:"First season",names:["WIT STUDIO"]},{title:"Second season",names:["MAPPA"]}]);
  expect(animationStudioCredits({...row,source:"mismatch"})).toEqual([]);
  expect(animationStudioCredits({...row,cours:row.cours.map(c=>({...c,studios:undefined}))})).toEqual([]);
  const same={...row,cours:row.cours.map(c=>({...c,studios:[{id:1,name:"WIT STUDIO"}]}))};
  expect(animationStudioCredits(same)).toEqual([{title:null,names:["WIT STUDIO"]}]);
  expect(animationStudioCredits({...same,cours:[same.cours[0],{...same.cours[1],studios:undefined}]})).toEqual([{title:"First season",names:["WIT STUDIO"]}]);
});
