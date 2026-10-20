import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScopeRatingReceipt } from "../components/detail/SeasonPanel";
import type { ScopeRatingContext } from "./scope-ratings";
const pending: ScopeRatingContext = { kind: "SEASON", number: 2, scope_key: "tmdb-season:2002", rating_id: "old", score: 9, validity: "NEEDS_RECONFIRMATION", covered_episodes: 13, provider_snapshot_id: "snapshot", mapping_snapshot_id: null, available_episodes: 23, range_start: 1, range_end: null };
describe("scoped rating reconfirmation UI", () => {
  it.each([1, 13])("describes frozen cour membership of %s episodes without a current endpoint", (count) => {
    const context: ScopeRatingContext = { ...pending, kind: "COUR", scope_key: "anilist-cour:501", covered_episodes: count };
    const html = renderToStaticMarkup(ScopeRatingReceipt({ context, score: 9, canConfirm: false, onConfirm() {} }));
    expect(html).toContain(`Originally rated ${count} ${count === 1 ? "episode" : "episodes"}`);
    expect(html).not.toContain("Rated through episode");
  });

  it("retains original coverage and does not offer confirmation before catching up", () => {
    const html = renderToStaticMarkup(ScopeRatingReceipt({ context: pending, score: 9, canConfirm: false, onConfirm() {} }));
    expect(html).toContain("Rated through episode 13");
    expect(html).toContain("Needs reconfirmation");
    expect(html).not.toContain("<button");
  });
  it("offers an explicit Confirm 9 after catching up, without auto-confirming", () => {
    let confirmations = 0;
    const node = ScopeRatingReceipt({ context: pending, score: 9, canConfirm: true, onConfirm() { confirmations++; } });
    expect(renderToStaticMarkup(node)).toContain("Confirm 9");
    expect(confirmations).toBe(0);
  });
  it("labels a legacy opinion as scope unverified", () => {
    const html = renderToStaticMarkup(ScopeRatingReceipt({ score: 9, canConfirm: true, onConfirm() {} }));
    expect(html).toContain("Rating scope unverified");
    expect(html).not.toContain("Rated through episode");
    expect(html).not.toContain("Confirm 9");
  });
});
