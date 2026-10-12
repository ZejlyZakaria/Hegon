import { describe, expect, it } from "vitest";
import { assertion, captureHistory, parseViewingInput, positionCoverage, viewingDate, type StoredViewingAssertion } from "./viewing-history";

describe("canonical viewing dates", () => {
  it.each([
    ["2022", { year: 2022, month: null, day: null, date_precision: "YEAR" }],
    ["2022-08", { year: 2022, month: 8, day: null, date_precision: "MONTH" }],
    ["2022-08-17", { year: 2022, month: 8, day: 17, date_precision: "DAY" }],
    ["2024-02-29", { year: 2024, month: 2, day: 29, date_precision: "DAY" }],
    ["2026", { year: 2026, month: null, day: null, date_precision: "YEAR" }],
  ])("preserves supplied precision: %s", (input, expected) => {
    expect(viewingDate(parseViewingInput(input))).toEqual(expected);
  });
  it.each(["2022-02-29", "2024-04-31", "2024-13", "2024-00", "2024-01-00", "0000", "2022-08-17T12:00:00Z"])("rejects invalid date or legacy timestamp %s", input => {
    expect(() => parseViewingInput(input)).toThrow();
  });
  it("unknown has no viewing date, including when captured today", () => {
    expect(viewingDate()).toEqual({ year: null, month: null, day: null, date_precision: "UNKNOWN" });
    expect(() => viewingDate({ year: 2022, month: null, day: 17 })).toThrow();
  });
});

const before = { type: "serie", current_season: 1, current_episode: 12, season_aired: [13,2], runtime: 45, season_years: { "1": 2022 }, watched: false };
const today = { year: 2026, month: 10, day: 12 };
describe("prospective history capture", () => {
  it("records only new bounded coverage, with actual day for an explicit viewing", () => {
    const result = captureHistory(before,{ current_episode: 13 },{ history_intent: "viewing", history_date: today });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ kind: "FIRST_WATCH", scope_key: "tmdb-season:1", date_precision: "DAY", day: 12,
      ranges: [{ episode_from: 13, episode_to: 13, minutes: 45 }] });
  });
  it("freezes inclusive coverage across a season boundary", () => {
    const result = captureHistory(before,{ current_season: 2, current_episode: 1 },{ history_intent: "viewing", history_date: today });
    expect(result.records.map(r => r.ranges.map(v => [v.season_number_at_recording,v.episode_from,v.episode_to]))).toEqual([[[1,13,13]],[[2,1,1]]]);
  });
  it("never reconstructs old scope from announced counts or records a provider refresh", () => {
    expect(positionCoverage({ ...before, season_aired: null })).toEqual([]);
    expect(positionCoverage({ ...before, season_aired: [0] })).toEqual([]);
    expect(captureHistory(before,{ runtime: 99 },{}).records).toEqual([]);
    const result = captureHistory({ ...before, season_aired: null },{ current_episode: 13 },{ history_intent: "claim" });
    expect(result.records[0]).toMatchObject({ scope_kind: "UNKNOWN", ranges: [], date_precision: "UNKNOWN" });
  });
  it("completion contributes no additional minutes and claim does not invent today", () => {
    const result = captureHistory(before,{ watched: true, current_episode: 13 },{ history_intent: "claim" });
    expect(result.records.map(r => r.kind)).toEqual(["FIRST_WATCH","COMPLETION"]);
    expect(result.records[0].ranges[0].minutes).toBe(45);
    expect(result.records[1].ranges.every(r => r.minutes === 0 && r.duration_basis === "MILESTONE")).toBe(true);
    expect(result.records.every(r => r.year === null && r.date_precision === "UNKNOWN")).toBe(true);
  });
  it("corrects existing explicit season assertions without adding another copy of coverage", () => {
    const original = captureHistory(before,{ current_episode: 13 },{ history_intent: "viewing", history_date: today }).records[0];
    const active = [{ ...original, id: "record-1" }] as StoredViewingAssertion[];
    const result = captureHistory({ ...before, current_episode: 13 },{ season_years: { "1": 2024 } },{},active);
    expect(result.retract_ids).toEqual(["record-1"]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ supersedes_id: "record-1", year: 2024, month: null, day: null, date_precision: "YEAR", ranges: original.ranges });
  });
  it("Undo retracts the new episode, never invents a replacement date", () => {
    const original = captureHistory(before,{ current_episode: 13 },{ history_intent: "viewing", history_date: today }).records[0];
    const result = captureHistory({ ...before, current_episode: 13 },{ current_episode: 12 },{ history_intent: "correction" },[{ ...original, id: "record-1" }]);
    expect(result).toEqual({ records: [], retract_ids: ["record-1"] });
  });
  it("partial backwards correction preserves original precision and proportional frozen duration", () => {
    const original = captureHistory({ ...before, current_episode: 0 },{ current_episode: 13 },{ history_intent: "viewing", history_date: today }).records[0];
    const result = captureHistory({ ...before, current_episode: 13 },{ current_episode: 10 },{ history_intent: "correction" },[{ ...original, id: "record-1" }]);
    expect(result.records[0]).toMatchObject({ supersedes_id: "record-1", year: 2026, month: 10, day: 12, ranges: [{ episode_from: 1, episode_to: 10, minutes: 450 }] });
  });
  it("film year correction retains its original assertion and uses no fabricated day", () => {
    const original = captureHistory(null,{ type: "film", watched: true, runtime: 90 },{ history_intent: "claim" }).records[0];
    const result = captureHistory({ type: "film", watched: true, runtime: 90 },{}, { history_date: { year: 2022, month: null, day: null } },[{ ...original, id: "film-1" }]);
    expect(result.records[0]).toMatchObject({ supersedes_id: "film-1", year: 2022, month: null, day: null });
    expect(result.retract_ids).toEqual(["film-1"]);
  });
  it("unknown runtime stays null; known zero is preserved", () => {
    expect(positionCoverage({ ...before, runtime: null })[0].minutes).toBeNull();
    expect(positionCoverage({ ...before, runtime: 0 })[0].minutes).toBe(0);
  });
  it("the existing rewatch input states a date, not a made-up scope", () => {
    expect(assertion("REWATCH",viewingDate(parseViewingInput("2022-08")),[])).toMatchObject({ date_precision: "MONTH", day: null, scope_kind: "UNKNOWN", ranges: [] });
  });
  it("legacy December 31 or first-of-month projections supply no canonical precision", () => {
    for (const watched_at of ["2022-12-31T12:00:00Z", "2022-08-01T12:00:00Z"]) {
      const result = captureHistory(null,{ type: "film", watched: true, watched_at },{ history_intent: "claim" });
      expect(result.records.every(r => r.date_precision === "UNKNOWN" && r.year === null)).toBe(true);
    }
  });
});


describe("retention boundaries", () => {
  it("ordinary posture changes retain past assertions and completion", () => {
    const film = { type: "film", watched: true, runtime: 90 };
    const old = captureHistory(null,film,{ history_intent: "claim" }).records.map((r,i) => ({ ...r, id: String(i) }));
    const next = captureHistory(film,{ watched: false },{ history_intent: "claim" },old);
    expect(next.retract_ids).toEqual([]);
  });
  it("a provider count regression cannot retract history on a new forward viewing", () => {
    const original = captureHistory({ ...before, current_episode: 0 },{ current_episode: 13 },{ history_intent: "viewing", history_date: today }).records[0];
    const next = captureHistory({ ...before, current_episode: 13, season_aired: [12,2] },{ current_season: 2, current_episode: 1 },
      { history_intent: "viewing", history_date: today },[{ ...original, id: "proof" }]);
    expect(next.retract_ids).toEqual([]);
  });
  it("clearing a supplied season year preserves coverage with UNKNOWN date", () => {
    const original = captureHistory(before,{ current_episode: 13 },{ history_intent: "viewing", history_date: today }).records[0];
    const next = captureHistory({ ...before,current_episode: 13 },{ season_years: {} },{},[{ ...original,id: "dated" }]);
    expect(next.records[0]).toMatchObject({ supersedes_id: "dated", date_precision: "UNKNOWN", year: null, month: null, day: null, ranges: original.ranges });
  });
});
