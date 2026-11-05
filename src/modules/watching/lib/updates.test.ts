import { describe, expect, it } from "vitest";
import { buildWatchingUpdates, isUpdateVisible, updatesCatalogueWorkKeys, type UpdatesData, type UpdatesMedia } from "./updates";
import type { AnimeCour } from "../types";

const media = (patch: Partial<UpdatesMedia> = {}): UpdatesMedia => ({ id: "show", tmdb_id: 42, type: "serie", title: "Northbound", poster_url: null, backdrop_url: null, year: 2020,
  watched: false, in_progress: true, paused: false, dropped: false, want_to_watch: false, is_reference: false, favorite: false,
  status: "ongoing", current_season: 1, current_episode: 10, season_episodes: [10, 8], season_aired: [10, 0],
  season_air_dates: ["2020-01-01", "2027-03-12"], ...patch });
const source = (item = media()): UpdatesData => ({ items: [item], cours: [], catalogues: [] });
function evidence(data: UpdatesData, dates = ["2026-11-01", "2026-11-02", "2026-11-03"], count = 8) {
  data.catalogues = [{ work_key: "tv:42", facts: { seasons: [{ id: 2, number: 2, announced: count, aired: dates.length,
    episodes: Array.from({ length: count }, (_, i) => ({ id: i + 1, number: i + 1, aired: i < dates.length, air_date: dates[i] ?? null })) }] } }];
  return data;
}
const today = "2026-11-05";
const cour = (id: number, number: number, start: number, episodes: number): AnimeCour => ({ anilist_id: id, season: number, title: `Part ${number}`,
  start_episode: start, end_episode: start + episodes - 1, episodes, year: 2026, end_year: 2026, poster_url: null });

describe("personal release updates", () => {
  it("shows a future season without resuming or dating a personal viewing", () => {
    const data = source(), before = JSON.stringify(data);
    expect(buildWatchingUpdates(data, today)).toMatchObject([{ scope: "Season 2", state: "upcoming", date: "2027-03-12", episodes: 0 }]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("counts only actually aired episodes, not all announced episodes", () => {
    expect(buildWatchingUpdates(evidence(source(media({ season_aired: [10, 3] }))), today)).toMatchObject([{ state: "available", episodes: 3 }]);
  });
  it("updates one weekly card with only unseen episodes and removes it when caught up", () => {
    expect(buildWatchingUpdates(evidence(source(media({ current_season: 2, current_episode: 2, season_aired: [10, 3] }))), today)).toMatchObject([{ episodes: 1, episodeFrom: 3, fullSeason: false }]);
    expect(buildWatchingUpdates(evidence(source(media({ current_season: 2, current_episode: 3, season_aired: [10, 3] }))), today)).toEqual([]);
  });
  it("does not invent an extra season from returning status", () => {
    expect(buildWatchingUpdates(source(media({ status: "ongoing", season_episodes: [10], season_aired: [10] })), today)).toEqual([]);
  });
  it("leaves unknown dates and unknown availability unknown", () => {
    expect(buildWatchingUpdates(source(media({ season_air_dates: [null, null], season_aired: [10] })), today)).toMatchObject([{ state: "tba", date: null, episodes: 0 }]);
    expect(buildWatchingUpdates(source(media({ season_air_dates: [null, "2027-02-30"] })), today)).toMatchObject([{ state: "tba", date: null }]);
  });
  it.each([{ type: "film" as const }, { is_reference: true }, { watched: false, in_progress: false }, { current_episode: 0 }])("excludes unstarted/non-followed works: %j", patch => {
    expect(buildWatchingUpdates(source(media(patch)), today)).toEqual([]);
  });
  it("does not promote an unaired stub on a canceled/ended work, while keeping actual released content", () => {
    expect(buildWatchingUpdates(source(media({ status: "canceled" })), today)).toEqual([]);
    expect(buildWatchingUpdates(evidence(source(media({ status: "ended", season_aired: [10, 8] }))), today)).toMatchObject([{ state: "available", episodes: 3 }]);
  });
  it("retains paused/dropped as explicitly secondary results", () => {
    expect(buildWatchingUpdates(source(media({ paused: true, in_progress: false })), today)[0].media.paused).toBe(true);
    expect(buildWatchingUpdates(source(media({ dropped: true, in_progress: false })), today)[0].media.dropped).toBe(true);
  });
  it("uses the existing anime overlay for flattened seasons", () => {
    const data = source(media({ type: "anime", season_episodes: [24], season_aired: [14], current_episode: 12 }));
    data.cours = [{ tmdb_id: 42, source: "anilist", cours: [cour(1, 1, 1, 12), cour(2, 2, 13, 12)] }];
    data.catalogues = [{ work_key: "tv:42", facts: { seasons: [{ id: 1, number: 1, announced: 24, aired: 14, episodes: [
      { id: 13, number: 13, aired: true, air_date: "2026-11-01" }, { id: 14, number: 14, aired: true, air_date: "2026-11-02" }
    ] }] } }];
    expect(buildWatchingUpdates(data, today)).toMatchObject([{ scope: "Season 2", state: "available", episodes: 2 }]);
  });
  it("uses stable accepted parts and their actual first-member release dates", () => {
    const data = source(media({ type: "anime", season_episodes: [12, 20], season_aired: [12, 10], current_season: 2, current_episode: 10, season_air_dates: ["2020-01-01", "2024-01-01"] }));
    data.cours = [{ tmdb_id: 42, source: "anilist", cours: [cour(1, 1, 1, 12), cour(2, 2, 13, 10), cour(3, 3, 23, 10)] }];
    data.catalogues = [{ work_key: "tv:42", facts: { seasons: [{ id: 2, number: 2, announced: 20, aired: 10, episodes: [{ id: 100, number: 11, aired: false, air_date: "2027-06-10" }] }] } }];
    expect(buildWatchingUpdates(data, today)).toMatchObject([{ id: "show:anilist:3", scope: "Season 2 · Part 2", state: "upcoming", date: "2027-06-10" }]);
    data.catalogues[0].facts.seasons[0].episodes[0].air_date = null;
    expect(buildWatchingUpdates(data, today)).toMatchObject([{ state: "tba", date: null }]);
  });
  it("never invents parts from broadcast gaps or unaccepted mappings", () => {
    const data = source(media({ type: "anime" }));
    data.cours = [{ tmdb_id: 42, source: "mismatch", cours: [cour(1, 1, 1, 10), cour(2, 2, 11, 8)] }];
    expect(buildWatchingUpdates(data, today)).toMatchObject([{ scope: "Season 2" }]);
  });
});

describe("release freshness and visibility", () => {
  it("shows a bulk drop in June, not the same backlog in November (The Bear)", () => {
    const data = evidence(source(media({ season_aired: [10, 8] })), Array(8).fill("2026-06-25"));
    expect(buildWatchingUpdates(data, "2026-06-25")).toMatchObject([{ fullSeason: true, episodes: 8 }]);
    expect(buildWatchingUpdates(data, "2026-07-25")).toHaveLength(1);
    expect(buildWatchingUpdates(data, "2026-07-26")).toEqual([]);
    expect(buildWatchingUpdates(data, today)).toEqual([]);
  });
  it("requires dated freshness, never a personal or catalogue refresh timestamp", () => {
    expect(buildWatchingUpdates(source(media({ season_aired: [10, 8], season_air_dates: [null, "2020-06-25"] })), today)).toEqual([]);
    expect(buildWatchingUpdates(evidence(source(), ["2027-01-01"]), today)).not.toMatchObject([{ state: "available" }]);
  });
  it("shows Silo premiere, then full season, without duplicate episode cards", () => {
    const data = evidence(source(media({ season_aired: [10, 1], season_episodes: [10, 2] })), ["2027-07-08"], 2);
    expect(buildWatchingUpdates(data, "2027-07-08")).toMatchObject([{ state: "available", episodes: 1, episodeFrom: 1, fullSeason: false }]);
    data.catalogues[0].facts.seasons[0].episodes[1] = { id: 2, number: 2, aired: true, air_date: "2027-07-15" };
    expect(buildWatchingUpdates(data, "2027-07-15")).toMatchObject([{ state: "available", episodes: 2, fullSeason: true }]);
  });
  it("keeps paused announcements (The Gentlemen), excludes dropped unless requested", () => {
    const paused = buildWatchingUpdates(source(media({ paused: true })), today)[0];
    expect(isUpdateVisible(paused)).toBe(true);
    const available = buildWatchingUpdates(evidence(source(media({ paused: true }))), today)[0];
    expect(isUpdateVisible(available)).toBe(false);
    const dropped = buildWatchingUpdates(source(media({ dropped: true })), today)[0];
    expect(isUpdateVisible(dropped)).toBe(false);
  });
  it("fetches TV and weekly evidence before filtering dates, skips fully consumed titles", () => {
    expect(updatesCatalogueWorkKeys(source(media({ current_season: 2, current_episode: 2 })))).toEqual(["tv:42"]);
    expect(updatesCatalogueWorkKeys(source(media({ current_season: 2, current_episode: 8 })))).toEqual([]);
  });
});

it("keeps an airing season through a confirmed hiatus without inventing an extra part", () => {
  const data = evidence(source(media({ season_aired: [10, 1], season_episodes: [10, 2] })), ["2026-09-01"], 2);
  data.catalogues[0].facts.seasons[0].episodes[1].air_date = "2026-12-01";
  expect(buildWatchingUpdates(data, today)).toMatchObject([{ scope: "Season 2", episodes: 1, fullSeason: false }]);
});

it("includes recent watchlist seasons without changing posture or surfacing old backlog", () => {
  const data = evidence(source(media({ want_to_watch: true, in_progress: false, current_season: 1, current_episode: 0 })));
  const before = JSON.stringify(data);
  expect(buildWatchingUpdates(data, today)).toMatchObject([{ scope: "Season 2", state: "available", episodes: 3 }]);
  expect(JSON.stringify(data)).toBe(before);
  expect(buildWatchingUpdates(data, "2027-01-01")).toEqual([]);
  expect(buildWatchingUpdates(source(media({ want_to_watch: true, in_progress: false, current_episode: 0 })), today)).toMatchObject([{state:"upcoming",scope:"Season 2"}]);
});

it("includes explicit future and TBA watchlist announcements without requiring viewing engagement", () => {
  const future = source(media({want_to_watch:true,in_progress:false,current_episode:0}));
  expect(buildWatchingUpdates(future,today)).toMatchObject([{state:"upcoming",scope:"Season 2"}]);
  future.items[0].season_air_dates=[null,null];
  const before=JSON.stringify(future);
  expect(buildWatchingUpdates(future,today)).toEqual(expect.arrayContaining([expect.objectContaining({state:"tba",scope:"Season 2"})]));
  expect(JSON.stringify(future)).toBe(before);
});

it("orders TBA started stories before watchlist stories, without hiding either", () => {
  const data = source(media({title:"Z Started",season_air_dates:[null,null]}));
  data.items.push(media({id:"wish",title:"A Watchlist",want_to_watch:true,in_progress:false,current_episode:0,season_air_dates:[null,null]}));
  expect(buildWatchingUpdates(data,today).filter(u=>u.state==="tba").map(u=>u.media.title)).toEqual(["Z Started","A Watchlist"]);
});
