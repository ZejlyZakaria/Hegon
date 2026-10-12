import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as jsx from "react/jsx-runtime";
import { isValidElement, type ReactElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { mediaIdentity } from "./possession";
import { experienceSummary } from "./person-experience";
import { followDepartment, creditRoleLabel } from "./credit-roles";
import { tmdbImageFor } from "./tmdb-image";
import type { StatsRawItem } from "../service";

// Execute the actual page/rail JSX with deterministic hook data; inspect React's own keys/props.
function component(path: string, extra: Record<string, unknown>, expose?: string) {
  const source = readFileSync(resolve(path), "utf8") + (expose ? `\nexport { ${expose} };` : "");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, unknown> = {};
  const deps: Record<string, unknown> = {
    "react/jsx-runtime": jsx,
    react: { useState: (value: unknown) => [value, () => {}], useEffect() {}, useRef: () => ({ current: null }) },
    "@/modules/watching/lib/possession": { mediaIdentity },
    "@/modules/watching/lib/person-experience": { experienceSummary },
    "@/modules/watching/lib/tmdb-image": { tmdbImageFor },
    "../../lib/credit-roles": { followDepartment, creditRoleLabel },
    "@/modules/watching/components/person/PersonTimelinePanel": { datedCount: () => 0, PersonTimelinePanel: () => null },
    ...extra,
  };
  const placeholder = () => null;
  runInNewContext(compiled, { exports, require: (id: string) => deps[id] ?? new Proxy({ __esModule: true, default: placeholder }, { get: (target, key) => key in target ? target[key as keyof typeof target] : placeholder }) });
  return exports;
}
function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
describe("Top Picks panel formatting", () => {
  it.each([[8.75, "8.75"], [8.5, "8.5"], [9, "9"], [8.333333, "8.33"]] as const)("displays %s as %s without changing the score", (rating, expected) => {
    const loaded = component("src/modules/watching/components/stats/StatsPage.tsx", {
      "next/navigation": { useRouter: () => ({ push() {} }) },
    }, "TopFavoritesCard");
    const card = loaded.TopFavoritesCard as (props: unknown) => unknown;
    const entry = { item: { id: "hannibal", title: "Hannibal", year: 2013, favorite: false } as StatsRawItem,
      seasonLabel: "Season 1 & 2", rating, seasonPoster: null };
    const panel = elements(card({ items: [entry] })).find((e) => e.props.title === "Top Picks" && "open" in e.props);
    expect(panel).toBeDefined();
    const row = elements(panel?.props.children).find((e) => "meta" in e.props);
    const meta = row?.props.meta as ReactElement<{ children: string }>;
    expect(meta.props.children).toBe(`Season 1 & 2 / ${expected}`);
    expect(entry.rating).toBe(rating);
  });
});
describe("Actual review UI regressions", () => {
  it("renders same-number movie/TV credits with separate stable React keys", () => {
    const credits = ["film", "serie"].map((type) => ({ type, tmdb_id: 1399, title: type, year: 2020, role: null, vote: 8, poster_url: null }));
    const load = () => component("src/app/(main)/perso/watching/person/[id]/page.tsx", {
      "next/navigation": { useParams: () => ({ id: "1" }), useRouter: () => ({ push() {}, back() {} }) },
      "@/shared/hooks/useCurrentUserId": { useCurrentUserId: () => "user" },
      "@/modules/watching/hooks/usePerson": {
        usePersonBundle: () => ({ data: { profile: { name: "Person", known_for_department: "Acting" }, credits }, isLoading: false }),
        useTitlesByPerson: () => ({ data: [], isFetched: true }), usePeopleCounts: () => ({ data: {}, isFetched: true }),
      },
      "@/modules/watching/hooks/useWatchingUIStore": { useWatchingUIStore: () => () => {} },
    });
    const keys = () => elements((load().default as () => unknown)()).map((e) => e.key).filter((key) => key === "movie:1399" || key === "tv:1399");
    expect(keys()).toEqual(["movie:1399", "tv:1399"]);
    credits.reverse();
    expect(keys()).toEqual(["tv:1399", "movie:1399"]);
  });
  it.each(["serie", "anime"])("passes truthful %s follow metadata through the real CastCrew rail", (type) => {
    const face = () => null;
    const loaded = component("src/modules/watching/components/detail/CastCrew.tsx", {
      "@/modules/watching/components/shared/PersonFace": { PersonFace: face },
    });
    const rail = loaded.CastCrew as (props: unknown) => unknown;
    const tree = rail({ type, directors: [
      { id: 1, name: "Creator", role: "creator", profile_url: null },
      { id: 2, name: "Director", role: "director", profile_url: null },
      { id: 3, name: "Legacy", profile_url: null },
    ], cast: [{ id: 4, name: "Cast", character: "Lead", profile_url: null }] });
    expect(elements(tree).filter((e) => e.type === face).map((e) => e.props.knownFor)).toEqual([
      "Creating", "Directing", null, type === "anime" ? "Voice Acting" : "Acting",
    ]);
  });
});
