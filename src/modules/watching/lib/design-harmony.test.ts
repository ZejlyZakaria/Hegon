import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AwardCategory, AwardEntry, WatchingMedia } from "../types";
import { PersonAccolades } from "../components/person/PersonAccolades";
import { Accolades } from "../components/detail/Accolades";
import { StatusMark } from "../components/shared/StatusBadge";
import { PersonInsights } from "../components/person/PersonInsights";
import { FollowMark } from "../components/shared/FollowMark";

const fixture = vi.hoisted(() => ({ person: [] as AwardEntry[], work: [] as AwardEntry[], followed: [] as number[], calls: [] as unknown[] }));
vi.mock("../hooks/useAwards", () => ({
  useAwardsForPerson: () => ({ data: fixture.person }),
  useAwardsForWork: () => ({ data: fixture.work }),
  useAwardCategories: () => ({ data: [
    { key: "actor", label: "Lead Actor", rank: 1 },
    { key: "support", label: "Supporting Actor", rank: 2 },
  ] as AwardCategory[] }),
}));
vi.mock("../hooks/useImdbId", () => ({ useImdbId: () => ({ data: null }) }));
vi.mock("../hooks/useOmdbRatings", () => ({ useOmdbRatings: () => ({ data: null }) }));
vi.mock("@/shared/hooks/useCurrentUserId", () => ({ useCurrentUserId: () => "owner" }));
vi.mock("../hooks/useFollows", () => ({ useFollowedIds: () => ({ data: fixture.followed }), useFollowActions: () => ({ mutate: (v: unknown) => fixture.calls.push(v) }) }));
const award = (id: number, ceremony: "oscars" | "emmys", won: boolean) => ({ id: String(id), ceremony, category: "actor", won, people: [], year: 2020 + id, work_title: "Work", work_type: "film", work_tmdb_id: id } as unknown as AwardEntry);

beforeEach(() => { fixture.person = []; fixture.work = []; fixture.followed = []; fixture.calls = []; });

describe("Watching design hierarchy", () => {
  it("shares award presentation while keeping person and work totals independent", () => {
    fixture.person = [award(1, "oscars", true), award(2, "oscars", true), award(3, "emmys", true), award(4, "emmys", false)];
    fixture.work = [award(1, "oscars", true)];
    const before = JSON.stringify(fixture.person);
    const person = renderToStaticMarkup(createElement(PersonAccolades, { personId: 7, name: "Actor", yourTitles: [] }));
    const work = renderToStaticMarkup(createElement(Accolades, { media: { id: "work", type: "film", tmdb_id: 1 } as WatchingMedia }));
    expect(person).toMatch(/>2<\/dd><dt[^>]*>Oscar wins/);
    expect(person).toContain("Emmy win"); expect(person).toContain("nomination");
    expect(work).toMatch(/>1<\/dd><dt[^>]*>Oscar win/);
    expect(work).not.toContain("Emmy win"); expect(work).not.toContain("nomination");
    for (const html of [person, work]) { expect(html).toContain("In tracked categories"); expect(html).toContain("Lead Actor"); }
    expect(JSON.stringify(fixture.person)).toBe(before);
  });
  it("keeps nomination-only and empty person summaries honest", () => {
    expect(renderToStaticMarkup(createElement(PersonAccolades, { personId: 7, name: "Actor", yourTitles: [] }))).toBe("");
    fixture.person = [award(1, "oscars", false)];
    const html = renderToStaticMarkup(createElement(PersonAccolades, { personId: 7, name: "Actor", yourTitles: [] }));
    expect(html).toContain("nomination"); expect(html).not.toContain("Oscar win"); expect(html).not.toContain("Lead Actor");
  });
  it("keeps poster status compact and watchlist identity separate", () => {
    const html = renderToStaticMarkup(createElement(StatusMark, { status: { label: "Paused", tone: "paused", level: null } }));
    expect(html).toContain('data-size="compact"'); expect(html).toContain("Paused"); expect(html).toContain("<svg");
    expect(renderToStaticMarkup(createElement(StatusMark, { status: { label: "Want to watch", tone: "want", level: "high" } }))).toBe("");
  });
  it("distinguishes follow from add without changing state during rendering", () => {
    const props = { personId: 7, name: "Actor" };
    const idle = renderToStaticMarkup(createElement(FollowMark, props));
    expect(idle).toContain('data-kind="follow"'); expect(idle).toContain('aria-label="Follow Actor"'); expect(idle).toContain("user-round-plus");
    fixture.followed = [7];
    const followed = renderToStaticMarkup(createElement(FollowMark, props));
    expect(followed).toContain('aria-pressed="true"'); expect(followed).toContain('aria-label="Unfollow Actor"');
    expect(fixture.calls).toEqual([]);
  });
});


it("shows larger full-width highlights and merges the same title without losing the world comparison",()=>{
  const best={id:"film",title:"Excellent film",poster_url:"https://image.tmdb.org/t/p/w500/poster.jpg",rating:9,meta:"2020"};
  const html=renderToStaticMarkup(createElement(PersonInsights,{data:{rank:{position:3,noun:"actor",count:4,tiedWith:["Another actor"]},best,hiddenGem:{...best,meta:"7.1",metaLogo:"/logo/watching_rating/Tmdb.svg"}}}));
  expect(html).toContain("Your highlights");expect(html).toContain("Highest rated");expect(html).toContain("Hidden gem");
  expect(html.match(/href="\/perso\/watching\/film"/g)).toHaveLength(1);
  expect(html).toContain("w-(--poster-sm)");expect(html).toContain('sizes="80px"');
  expect(html).toContain("TMDB");expect(html).toContain("7.1");expect(html).toContain("2020");expect(html).toContain("Tied with Another actor");
});
