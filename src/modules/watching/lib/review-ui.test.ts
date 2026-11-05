import { QueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS, PEOPLE_KEYS } from "../hooks/query-keys";
import * as mutationDependencies from "./mutation-dependencies";
import { renderToStaticMarkup } from "react-dom/server";
import * as timelineHelpers from "./viewing-timeline";
import * as rewatchHelpers from "./rewatch";
import * as historyHelpers from "./history-analytics";
import { parseViewingInput } from "./viewing-history";
import * as seriesFacts from "./series-state";
import { isWatchableNow } from "./watchable";
import { canComplete, deriveWatchStatus, resumePatch } from "./watch-status";
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
import { tmdbImage, tmdbImageFor, tmdbImageSrcSet } from "./tmdb-image";
import type { StatsRawItem } from "../service";

// Execute the actual page/rail JSX with deterministic hook data; inspect React's own keys/props.
function component(path: string, extra: Record<string, unknown>, expose?: string) {
  const source = readFileSync(resolve(path), "utf8") + (expose ? `\nexport { ${expose} };` : "");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, unknown> = {};
  const deps: Record<string, unknown> = {
    "@/shared/components/ui/button": { Button: "button" },
    "react/jsx-runtime": jsx,
    "../../lib/rewatch": rewatchHelpers,
    "../../lib/viewing-timeline":timelineHelpers,
    "../../hooks/useMediaHistory":{useMediaHistory:()=>({data:{records:[]},isPending:false})},
    "../../lib/history-analytics": historyHelpers,
    react: { useState: (value: unknown) => [value, () => {}], useEffect() {}, useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }) },
    "@/modules/watching/lib/possession": { mediaIdentity },
    "@/modules/watching/lib/person-experience": { experienceSummary },
    "@/modules/watching/lib/tmdb-image": { tmdbImage, tmdbImageFor, tmdbImageSrcSet },
    "../../lib/tmdb-image": { tmdbImage, tmdbImageFor, tmdbImageSrcSet },
    "../../lib/credit-roles": { followDepartment, creditRoleLabel },
    "@/modules/watching/components/person/PersonTimelinePanel": { datedCount: () => 0, PersonTimelinePanel: () => null },
    ...extra,
  };
  const placeholder = () => null;
  runInNewContext(compiled, { exports, Error, require: (id: string) => deps[id] ?? new Proxy({ __esModule: true, default: placeholder }, { get: (target, key) => key in target ? target[key as keyof typeof target] : placeholder }) });
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


describe("Wave2C explicit rewatch form",()=>{
  it.each(["2022","2022-08","2022-08-12"])("preserves exact user precision %s",(input)=>{
    const values=[input,"WHOLE_TITLE",[],""];let call=0;let submitted:unknown;
    const loaded=component("src/modules/watching/components/detail/RewatchForm.tsx",{
      react:{useState:()=>[values[call++],()=>{}]},
      "@tanstack/react-query":{useQuery:()=>({data:{seasons:[],cours:[]}}),useQueryClient:()=>({})},
      "../../lib/viewing-history":{parseViewingInput},
      "../../hooks/query-keys":{WATCHING_KEYS:{all:["watching"]}},
    });
    const form=loaded.RewatchForm as (props:unknown)=>unknown;
    const button=elements(form({media:{id:"movie",type:"film"},view:{pending:false,overlaid:false,seasons:[]},date:input,pending:false,onClose(){},onSave:(request:unknown)=>{submitted=request;}})).find(e=>e.type==="button" && e.props.children==="Record rewatch");
    expect(button?.props.disabled).toBe(false);(button!.props.onClick as ()=>void)();
    expect(submitted).toMatchObject({date:parseViewingInput(input),scope:{kind:"WHOLE_TITLE"}});
  });
  it("blocks stale cour mapping until the displayed identity/range matches",()=>{
    let writes=0;
    const render=(id:number)=>{
      const values=["2022","SEASONS",[1],""];let call=0;
      const loaded=component("src/modules/watching/components/detail/RewatchForm.tsx",{
        react:{useState:()=>[values[call++],()=>{}]},
        "@tanstack/react-query":{useQuery:()=>({data:{snapshot_id:"snapshot",seasons:[{id:200,number:1,announced:13,aired:13,episodes:Array.from({length:13},(_,i)=>({id:100+i,number:i+1,aired:true,air_date:"2020-01-01"}))}],cours:[{id:502,number:1,start:1,end:13}]}}),useQueryClient:()=>({})},
        "../../lib/viewing-history":{parseViewingInput},
      "../../hooks/query-keys":{WATCHING_KEYS:{all:["watching"]}},
      });
      return elements((loaded.RewatchForm as (props:unknown)=>unknown)({media:{id:"anime",type:"anime"},view:{pending:false,overlaid:true,seasons:[{season:1}],cours:[{anilist_id:id,season:1,start_episode:1,end_episode:13}]},date:"2022",pending:false,onClose(){},onSave(){writes++;}})).find(e=>e.type==="button" && e.props.children==="Record rewatch")!;
    };
    const stale=render(501);expect(stale.props.disabled).toBe(true);(stale.props.onClick as ()=>void)();expect(writes).toBe(0);
    const refreshed=render(502);expect(refreshed.props.disabled).toBe(false);(refreshed.props.onClick as ()=>void)();expect(writes).toBe(1);
  });
});

describe("watchable consumption actions", () => {
  const deps = {
    "../../lib/watchable": { isWatchableNow },
    "../../lib/watch-status": { canComplete, deriveWatchStatus },
    "../../lib/drop-reasons": { dropReasonLabel: () => null },
    "../../hooks/useRewatches": {
      useRewatches: () => ({ data: [] }),
      useAddRewatch: () => ({ isPending: false }),
      useRemoveRewatch: () => ({ isPending: false }),
    },
    "../../lib/series-state": seriesFacts,
    "../shared/StatusBadge": { watchlistLevel: () => "medium" },
    "../shared/Marks": { WATCHLIST_COLOR: { medium: "orange" } },
  };
  it.each(["film", "serie", "anime"])("hides unavailable consumption in the %s detail card", (type) => {
    const loaded = component("src/modules/watching/components/detail/StatusCard.tsx", deps);
    const render = loaded.StatusCard as (props: unknown) => unknown;
    const media = { id: "upcoming", type, release_date: "2099-01-01", season_aired: [0],
      season_episodes: [8], want_to_watch: true, status: "ongoing", current_episode: 0 };
    const nodes = elements(render({ media, isSeries: type !== "film", currentSeason: 1, currentEpisode: 0 }));
    const text = nodes.map((node) => node.props.children).flat(Infinity).filter((child) => typeof child === "string");
    expect(text).not.toContain("Start watching");
    expect(text).not.toContain("Mark as watched");
    expect(text).not.toContain("Seen everything that's out");
    expect(text.some((value) => String(value).includes("Not released yet"))).toBe(true);
    expect(text).toContain("Want to Watch");
  });
  it.each(["film", "serie", "anime"])("keeps released %s detail actions", (type) => {
    const loaded = component("src/modules/watching/components/detail/StatusCard.tsx", deps);
    const render = loaded.StatusCard as (props: unknown) => unknown;
    const nodes = elements(render({ media: { id: "released", type, release_date: "2020-01-01",
      status: "released", season_aired: [1], season_episodes: [8], want_to_watch: true },
      isSeries: type !== "film", currentSeason: 1, currentEpisode: 0 }));
    const text = nodes.map((node) => node.props.children).flat(Infinity).filter((child) => typeof child === "string");
    expect(text).toContain(type === "film" ? "Mark as watched" : "Start watching");
  });
  it.each(["film", "serie", "anime"])("guards unavailable %s actions without a mutation", async (type) => {
    let writes = 0;
    const loaded = component("src/modules/watching/hooks/useWatchActions.tsx", {
      "../lib/watchable": { isWatchableNow }, "../lib/watch-status": { canComplete },
      "./useUpdateMedia": { useUpdateMedia: () => ({ mutateAsync: () => { writes++; } }) },
      "./useMediaView": { useMediaView: () => null },
      "@tanstack/react-query": { useQueryClient: () => ({}) },
      "@/shared/utils/toast": { toast: { error() {} } },
    });
    const hook = loaded.useWatchActions as (media: unknown) => { canMark: boolean; canConsume: boolean;
      startWatching(): Promise<unknown>; markWatched(): Promise<unknown>; markCaughtUp(): Promise<unknown> };
    const actions = hook({ id: "upcoming", type, release_date: "2099-01-01", season_aired: [0] });
    expect(actions.canMark).toBe(false);
    expect(actions.canConsume).toBe(false);
    await actions.startWatching(); await actions.markWatched(); await actions.markCaughtUp();
    expect(writes).toBe(0);
  });
});


describe("discover availability outside the library", () => {
  it.each(["film", "serie", "anime"])("offers only Want to watch for an upcoming %s", (type) => {
    const media = { type, title: "Upcoming", release_date: "2099-01-01", season_aired: [0], tags: [] };
    const data = () => ({ data: undefined, isLoading: false });
    const loaded = component("src/app/(main)/perso/watching/discover/[type]/[tmdbId]/page.tsx", {
      "next/navigation": { useParams: () => ({ type, tmdbId: "1" }), useRouter: () => ({}) },
      "@tanstack/react-query": { useQueryClient: () => ({}) },
      "@/modules/watching/lib/watchable": { isWatchableNow },
      "@/modules/watching/lib/media-view": { buildMediaView: () => ({ seasons: [], overlaid: false }) },
      "@/modules/watching/hooks/useTmdbDetails": { useTmdbDetails: () => ({ data: media }) },
      "@/modules/watching/hooks/useTitleBundle": { useTitleBundle: data },
      "@/modules/watching/hooks/useAddMedia": { useAddMedia: () => ({}) },
      "@/modules/watching/hooks/useSimilarTitles": { useSimilarTitles: data },
      "@/modules/watching/hooks/useMediaCredits": { useMediaCredits: data },
      "@/modules/watching/hooks/useMediaTrailer": { useMediaTrailer: data },
      "@/modules/watching/hooks/useOwnedTmdbIds": { useOwnedMediaId: data, useOwnedTmdbIds: data },
      "@/modules/watching/hooks/useWatchProviders": { useWatchProviders: data },
      "@/modules/watching/hooks/useAnimeCours": { useAnimeCours: data },
      "@/modules/watching/hooks/useWatchingUIStore": { useWatchingUIStore: () => () => {} },
    });
    const page = loaded.default as () => unknown;
    const text = elements(page()).map((node) => node.props.children).flat(Infinity)
      .filter((child) => typeof child === "string").join(" ");
    expect(text).toContain("Want to watch");
    expect(text).not.toContain("Mark as watched");
    expect(text).not.toContain("Start watching");
    expect(text).not.toContain("I'm caught up");
  });
});


describe("Stats duration notice layout",()=>{
  it.each([0,1,4])("keeps %s incomplete durations in the Hours grid column",(count)=>{
    const source=ts.createSourceFile("StatsPage.tsx",readFileSync(resolve("src/modules/watching/components/stats/StatsPage.tsx"),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let grid:ts.JsxElement|undefined;
    const visit=(node:ts.Node)=>{
      if(ts.isJsxElement(node) && node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p) && p.name.getText(source)==="className" && p.initializer && ts.isStringLiteral(p.initializer) && p.initializer.text==="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3")) grid=node;
      ts.forEachChild(node,visit);
    };
    visit(source);expect(grid).toBeDefined();
    const code=`exports.render=stats=>{const selectedYear=2026,setOpenSlice=()=>{};return (${grid!.getText(source)});}`;
    const exports:{render?:(stats:unknown)=>ReactElement<Record<string,unknown>>}={};
    runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:()=>jsx,HoursCard:()=>null,ActivityCard:()=>null,RatingDistributionCard:()=>null});
    const tree=exports.render!({unknownDurationEvents:count,hours:{},activity:[],ratingDistribution:[]});
    const columns=(tree.props.children as unknown[]).filter(isValidElement);
    expect(columns).toHaveLength(3);
    const paragraphs=elements(columns[0]).filter(e=>e.type==="p");
    expect(paragraphs).toHaveLength(count>0 ? 1:0);
    if(count>0) expect(renderToStaticMarkup(paragraphs[0])).toContain(`${count} viewing ${count===1 ? "event has":"events have"} incomplete duration.`);
    expect(renderToStaticMarkup(tree)).not.toContain("Hours include known duration only.");
  });
});


describe("Uninitialized episode catalogue feedback",()=>{
  it("explains missing robot data without implying a refresh reconstructs historical scope",()=>{
    const loaded=component("src/modules/watching/components/detail/RewatchForm.tsx",{
      "@tanstack/react-query":{useQuery:()=>({data:rewatchHelpers.emptyCatalogue()}),useQueryClient:()=>({invalidateQueries:async()=>{}})},
      "../../lib/viewing-history":{parseViewingInput},
      "../../hooks/query-keys":{WATCHING_KEYS:{all:["watching"]}},
    });
    const tree=(loaded.RewatchForm as (p:unknown)=>ReactElement)({media:{id:"legacy-tv",type:"serie",season_aired:[63],runtime:56},view:{pending:false,overlaid:false,seasons:[]},date:"2022",pending:false,onSave(){},onClose(){}});
    expect(renderToStaticMarkup(tree)).toContain("Episode history has not been synced for this title yet.");
    const buttons=elements(tree).filter(e=>e.type==="button");
    expect(buttons.find(e=>e.props.children==="Record rewatch")?.props.disabled).toBe(true);
    expect(buttons.some(e=>e.props.children==="Check sync status")).toBe(true);
  });
});


it.each(["film","serie","anime"])("omits release-year fallback in both Top Picks surfaces for %s",type=>{
  const loaded=component("src/modules/watching/components/stats/StatsPage.tsx",{"next/navigation":{useRouter:()=>({push(){}})}},"TopFavoritesCard");
  const tree=(loaded.TopFavoritesCard as (props:unknown)=>unknown)({items:[{item:{id:"whole",type,title:"Whole work",year:1999},seasonLabel:null,rating:8.75,seasonPoster:null}]});
  const rows=elements(tree).filter(e=>"meta" in e.props);
  expect(rows).toHaveLength(2);
  for(const row of rows){const text=renderToStaticMarkup(row.props.meta as ReactElement);expect(text).toContain("8.75");expect(text).not.toContain("1999");}
});

describe("rewatch form design-system controls",()=>{
  it("keeps a compact primary save and secondary cancel without stretching both across the card",()=>{
    let call=0;const values=["2022-08-12","WHOLE_TITLE",[],""];
    const loaded=component("src/modules/watching/components/detail/RewatchForm.tsx",{
      react:{useState:()=>[values[call++],()=>{}]},
      "@tanstack/react-query":{useQuery:()=>({}),useQueryClient:()=>({})},
      "../../lib/viewing-history":{parseViewingInput},
      "../../hooks/query-keys":{WATCHING_KEYS:{all:["watching"]}},
    });
    const tree=(loaded.RewatchForm as (props:unknown)=>unknown)({media:{id:"film",type:"film"},view:{pending:false,seasons:[]},date:"2022-08-12",pending:false,onClose(){},onSave(){}});
    const buttons=elements(tree).filter(e=>e.type==="button");
    const save=buttons.find(e=>e.props.children==="Record rewatch")!,cancel=buttons.find(e=>e.props.children==="Cancel")!;
    expect(save.props).toMatchObject({variant:"accent",size:"sm",disabled:false});
    expect(cancel.props).toMatchObject({variant:"subtle",size:"sm"});
    expect(save.props.className).not.toContain("flex-1");
  });
});

describe("My Take refresh after a scoped edit",()=>{
  it("adopts the server's revised global projection while preserving an unsaved draft",()=>{
    const changes:unknown[][]=[[],[]];let state=0,ref=0;
    const refs=[{current:"title"},{current:1},{current:null},{current:null},{current:null as unknown}];
    const loaded=component("src/modules/watching/components/detail/MyTake.tsx",{
      react:{useState:(v:unknown)=>{const i=state++;return [v,(next:unknown)=>{changes[i]?.push(next);}];},useRef:()=>refs[ref++] ?? {current:null},useEffect:(effect:()=>void)=>{effect();}},
      "../../hooks/useUpdateMedia":{useUpdateMedia:()=>({})},
      "../../hooks/useRatingPercentile":{useRatingStanding:()=>null},
    });
    const render=loaded.MyTake as (props:unknown)=>unknown;
    render({media:{id:"title",type:"serie",user_rating:9,notes:"Kept",personal_revision:2}});
    expect(changes[0]).toEqual([9]);expect(changes[1]).toEqual(["Kept"]);
    state=0;ref=0;refs[4].current={notes:"Draft",rating:8};
    render({media:{id:"title",type:"serie",user_rating:9.5,notes:"Server",personal_revision:3}});
    expect(changes[0]).toEqual([9]);expect(changes[1]).toEqual(["Kept"]);
  });
});

describe("human viewing history rows",()=>{
  it("renders one film viewing with duration and no storage coordinates or audit codes",()=>{
    const loaded=component("src/modules/watching/components/detail/ViewingHistory.tsx",{"../../lib/viewing-timeline":timelineHelpers});
    const render=loaded.ViewingHistory as (props:unknown)=>ReactElement;
    const html=renderToStaticMarkup(render({mediaType:"film",summary:{first:{id:"first",label:"First viewing",period:"30 Oct 2026",minutes:156,children:[]},rewatches:[],firstCoverage:[],hasParts:false},onEditRewatch(){},onRemoveRewatch(){}}));
    expect(html).toContain("First viewing");expect(html).toContain("30 Oct 2026");expect(html).toContain("2h 36m");
    for(const code of ["Season 0","FIRST_WATCH","COMPLETION","WHOLE_TITLE","milestone","Rating assertions"]) expect(html).not.toContain(code);
  });
  it("keeps the GOT rewatch concise and presents frozen duration in hours",()=>{
    const loaded=component("src/modules/watching/components/detail/ViewingHistory.tsx",{"../../lib/viewing-timeline":timelineHelpers});
    const html=renderToStaticMarkup((loaded.ViewingHistoryRow as (props:unknown)=>ReactElement)({film:false,entry:{id:"got",kind:"REWATCH",date:{year:2024,month:3,day:22},scope:"Entire series",minutes:4232,ranges:[1,2,3,4,5,6,7,8].map(season=>({season,from:1,to:10}))},onEditRewatch(){},onRemoveRewatch(){}}));
    expect(html).toContain("22 Mar 2024");expect(html).toContain("70h 32m");expect(html).toContain("Entire series");expect(html).not.toContain("Season 1");
  });
});

describe("Best Episodes native still quality",()=>{
  it("offers the native original on high-density screens without a fabricated upscale",()=>{
    const loaded=component("src/modules/watching/components/detail/Episodes.tsx",{},"StillCard");
    const render=loaded.StillCard as (props:unknown)=>unknown;
    const tree=render({still:"https://image.tmdb.org/t/p/w500/frame.jpg",line1:"S1.E1",line2:"Episode title",overview:null,onRemove(){},backdrop:null});
    const image=elements(tree).find(e=>e.type==="img")!;
    expect(image.props).toMatchObject({src:"https://image.tmdb.org/t/p/w500/frame.jpg",srcSet:"https://image.tmdb.org/t/p/w300/frame.jpg 1x, https://image.tmdb.org/t/p/original/frame.jpg 2x",loading:"lazy",decoding:"async",alt:"Episode title"});
    expect(elements(tree).some(e=>typeof e.props.className==="string" && e.props.className.includes("w-66"))).toBe(true);
  });
  it("preserves the blurred fallback when no episode still is available",()=>{
    const loaded=component("src/modules/watching/components/detail/Episodes.tsx",{},"StillCard");
    const tree=(loaded.StillCard as (props:unknown)=>unknown)({still:null,line1:"S1.E1",line2:"Episode title",overview:null,onRemove(){},backdrop:"https://image.tmdb.org/t/p/w1280/show.jpg"});
    const image=elements(tree).find(e=>e.type==="img")!;
    expect(image.props.src).toBe("https://image.tmdb.org/t/p/w1280/show.jpg");expect(image.props.srcSet).toBeUndefined();
    expect(image.props.className).toContain("blur");
  });
});


it("Updates resumes a selected row through the existing writer without inventing consumption", async () => {
  const writes:Record<string,unknown>[]=[];
  const loaded=component("src/modules/watching/hooks/useWatchActions.tsx",{
    "../lib/watch-status": {resumePatch},
    "../lib/watchable": {isWatchableNow},
    "./useMediaView": {useMediaView:()=>null},
    "./useUpdateMedia": {useUpdateMedia:()=>({isPending:false,mutateAsync:async (patch:Record<string,unknown>)=>{writes.push(patch);return {personal_revision:8};}})},
    "@tanstack/react-query": {useQueryClient:()=>({})},
    "@/shared/utils/toast": {toast:()=>{}},
  });
  const actions=(loaded.useWatchActions as (media:null)=>{resumeItem:(row:unknown)=>Promise<unknown>})(null);
  await actions.resumeItem({id:"selected",type:"anime",personal_revision:7,season_aired:[10,1]});
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({id:"selected",type:"anime",expected_revision:7,history_intent:"claim",in_progress:true,watched:false,resume_required:false});
  for(const field of ["history_date","watched_at","last_watched_at","current_season","current_episode","season_years","cour_years","user_rating"])expect(writes[0]).not.toHaveProperty(field);
});


it.each(["anime","film"])("keeps Updates resume revisions fresh after a %s note edit", type => {
  const client=new QueryClient();
  const key=WATCHING_KEYS.updates("owner","org");
  client.setQueryData(key,{items:[{id:"selected",personal_revision:1}]});
  const loaded=component("src/modules/watching/hooks/useUpdateMedia.ts",{
    "@tanstack/react-query": {useQueryClient:()=>client,useMutation:(options:unknown)=>options},
    "./query-keys": {WATCHING_KEYS,PEOPLE_KEYS},
    "../lib/mutation-dependencies": mutationDependencies,
    "@/modules/settings/hooks/useSettings": {useIsDemo:()=>false},
  });
  const mutation=(loaded.useUpdateMedia as ()=>{onSuccess:(saved:unknown,input:unknown)=>void})();
  mutation.onSuccess({id:"selected",personal_revision:2},{id:"selected",type,notes:"Updated note"});
  expect(client.getQueryState(key)?.isInvalidated).toBe(type!=="film");
  client.clear();
});
