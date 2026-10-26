import { buildMediaView } from "./media-view";
import { describe, expect, it } from "vitest";
import { compactSeason } from "../../../../supabase/functions/_shared/provider-evidence";
import { ratingValidity, ratingAction, scopeMatchesView, scopeDisplayScores } from "./scope-ratings";

describe("compact provider evidence", () => {
  const season = { id: 2002, season_number: 2, episode_count: 2 };
  it("preserves stable IDs and leaves missing dates unknown", () => {
    const observed = compactSeason(season, [{ id: 2, episode_number: 2, air_date: "2027-01-01" }, { id: 1, episode_number: 1, air_date: null }], "2026-10-13");
    expect(observed.aired).toBeNull();
    expect(observed.announced).toBe(2);
    expect(observed.episodes.map((e) => e.id)).toEqual([1,2]);
    expect(observed.episodes[0].air_date).toBeNull();
    expect(compactSeason({ ...season, episode_count: 1 }, [{ id: 1, episode_number: 1, air_date: "2027-01-01" }], "2026-10-13").aired).toBe(0);
  });
  it("keeps relevant facts only", () => {
    const e = { id: 1, episode_number: 1, air_date: "2020-01-01", overview: "not archived" };
    expect(compactSeason({ ...season, episode_count: 1 }, [e], "2026-10-13").episodes[0]).toEqual({ id: 1, number: 1, air_date: "2020-01-01", aired: true });
  });
  it("rejects incomplete membership, duplicate IDs and impossible dates", () => {
    expect(() => compactSeason(season, [], "2026-10-13")).toThrow();
    expect(() => compactSeason(season, [{ id: 1, episode_number: 1, air_date: null }, { id: 1, episode_number: 2, air_date: null }], "2026-10-13")).toThrow();
    expect(() => compactSeason({ ...season, episode_count: 1 }, [{ id: 1, episode_number: 1, air_date: "2026-02-30" }], "2026-10-13")).toThrow();
  });
});
describe("scoped rating lifecycle", () => {
  const old = Array.from({ length: 13 }, (_,i) => i+1);
  const expanded = Array.from({ length: 23 }, (_,i) => i+1);
  it("keeps 9 pending after growth regardless of catching up", () => {
    expect(ratingValidity(9,old,old)).toBe("CURRENT");
    expect(ratingValidity(9,old,expanded)).toBe("NEEDS_RECONFIRMATION");
    expect(ratingValidity(9,old,expanded)).toBe("NEEDS_RECONFIRMATION");
    expect(ratingValidity(9,expanded,expanded)).toBe("CURRENT");
    expect(ratingValidity(8.5,expanded,expanded)).toBe("CURRENT");
  });
  it("leaves legacy and remapped membership explicitly unverified", () => {
    expect(ratingValidity(9,null,old)).toBe("SCOPE_UNVERIFIED");
    expect(ratingValidity(9,old,expanded.slice(10))).toBe("SCOPE_UNVERIFIED");
    expect(ratingValidity(null,null,old)).toBe("UNRATED");
  });
  it("distinguishes confirmation from revision and clearing", () => {
    const context = { kind: "SEASON" as const, number: 2, scope_key: "tmdb-season:2002", rating_id: "old", score: 9, validity: "NEEDS_RECONFIRMATION" as const, covered_episodes: 13, provider_snapshot_id: "snapshot", mapping_snapshot_id: null, available_episodes: 23, range_start: 1, range_end: null };
    expect(ratingAction(context,9)).toBe("CONFIRM");
    expect(ratingAction(context,8.5)).toBe("REVISE");
    expect(ratingAction(context,null)).toBe("CORRECTION");
    expect(ratingAction(undefined,9)).toBe("INITIAL");
  });
});


describe("rating context versus displayed scope", () => {
  const view = buildMediaView({ type: "serie", season_episodes: [0,23], season_aired: [0,23], current_season: 2, current_episode: 23 }, null);
  const context = { kind: "SEASON" as const, number: 2, scope_key: "tmdb-season:2002", rating_id: "old", score: 9, validity: "NEEDS_RECONFIRMATION" as const, covered_episodes: 13, provider_snapshot_id: "snapshot", mapping_snapshot_id: null, available_episodes: 23, range_start: 1, range_end: null };
  it("rejects stale episode ceilings and pending coordinate lenses", () => {
    expect(scopeMatchesView(context,view,2)).toBe(true);
    expect(scopeMatchesView({ ...context, available_episodes: 24 },view,2)).toBe(false);
    expect(scopeMatchesView(context,{ ...view, pending: true },2)).toBe(false);
    expect(scopeDisplayScores([{ ...context, available_episodes: 24 }],view)).toEqual({});
  });
  it("cannot bind an old cour ordinal or shifted range to the current context", () => {
    const cour = { season: 1, anilist_id: 501, title: "Cour", poster_url: null, year: 2020, end_year: 2020, episodes: 13, start_episode: 1, end_episode: 13 };
    const overlaid = { ...view, overlaid: true, cours: [cour], seasons: [{ season: 1, episodes: 13, aired: 13, airedKnown: true, poster: null, endDate: null }] };
    const current = { ...context, kind: "COUR" as const, number: 1, scope_key: "anilist-cour:501", available_episodes: 13, range_start: 1, range_end: 13 };
    expect(scopeMatchesView(current,overlaid,1)).toBe(true);
    expect(scopeMatchesView({ ...current, scope_key: "anilist-cour:502" },overlaid,1)).toBe(false);
    expect(scopeMatchesView({ ...current, range_start: 11, range_end: 23 },overlaid,1)).toBe(false);
  });
});


describe("Durable episode runtime evidence",()=>{
  it("keeps an optional bounded episode runtime and excludes provider transport noise",()=>{
    const season={id:201,season_number:1,episode_count:1};
    const episode={id:101,episode_number:1,air_date:"2022-01-01",runtime:24,overview:"transport only"};
    expect(compactSeason(season,[episode],"2026-10-21").episodes[0]).toEqual({id:101,number:1,air_date:"2022-01-01",aired:true,runtime:24});
    for(const runtime of [0,-1,Infinity,1441]) expect(compactSeason(season,[{...episode,runtime}],"2026-10-21").episodes[0].runtime).toBeNull();
  });
});


describe("Proven absolute anime episode numbering",()=>{
  const season={id:54606,season_number:2,episode_count:74};
  const episodes=Array.from({length:74},(_,i)=>({id:1000+i,episode_number:63+i,air_date:"2014-01-01",runtime:24}));
  it("normalizes Hunter x Hunter S2 63..136 to1..74 while retaining identity/date/runtime",()=>{
    const result=compactSeason(season,episodes,"2026-10-22",62);
    expect(result.announced).toBe(74);expect(result.aired).toBe(74);
    expect(result.episodes[0]).toEqual({id:1000,number:1,air_date:"2014-01-01",aired:true,runtime:24});
    expect(result.episodes.at(-1)?.number).toBe(74);
    expect(result.episodes.map(e=>e.id)).toEqual(episodes.map(e=>e.id));
    expect(episodes[0].episode_number).toBe(63);
  });
  it("normalizes Hunter x Hunter S3 137..148 using the cumulative136 boundary",()=>{
    const result=compactSeason({id:77711,season_number:3,episode_count:12},Array.from({length:12},(_,i)=>({id:2000+i,episode_number:137+i,air_date:"2014-09-23"})),"2026-10-22",136);
    expect(result.episodes.map(e=>e.number)).toEqual(Array.from({length:12},(_,i)=>i+1));
  });
  it("leaves normal season-local numbering unchanged even with an absolute offset",()=>{
    const local=episodes.map((e,i)=>({...e,episode_number:i+1}));
    expect(compactSeason(season,local,"2026-10-22",62).episodes.map(e=>e.number)).toEqual(local.map(e=>e.episode_number));
  });
  it("rejects missing proof, wrong offsets, incomplete blocks, gaps and duplicates",()=>{
    expect(()=>compactSeason(season,episodes,"2026-10-22")).toThrow();
    expect(()=>compactSeason(season,episodes,"2026-10-22",61)).toThrow();
    expect(()=>compactSeason(season,episodes.slice(1),"2026-10-22",62)).toThrow();
    expect(()=>compactSeason(season,episodes.map((e,i)=>i===0 ? {...e,episode_number:64}:e),"2026-10-22",62)).toThrow();
    expect(()=>compactSeason(season,episodes.map((e,i)=>i===0 ? {...e,id:1001}:e),"2026-10-22",62)).toThrow();
    expect(()=>compactSeason({...season,season_number:1},episodes,"2026-10-22",62)).toThrow();
  });
});
