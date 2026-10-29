import { QueryClient } from "@tanstack/react-query";
import { WATCHING_KEYS, PEOPLE_KEYS } from "../hooks/query-keys";
import * as dependencies from "./mutation-dependencies";
import { isWatchableNow } from "./watchable";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as status from "./watch-status";

// Execute the real hook with React/transport boundaries supplied by the harness.
// Database semantics are tested separately against real PostgreSQL, never a mocked DB.
function actionsHarness() {
  let revision = 3;
  const requests: Array<Record<string, unknown>> = [];
  const source = readFileSync("src/modules/watching/hooks/useWatchActions.tsx","utf8");
  const js = ts.transpileModule(source,{ compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (media: unknown, view: unknown) => Record<string, (...args: unknown[]) => Promise<Record<string, unknown> | null>>> = {};
  const toast = Object.assign(() => {},{ error: () => {}, custom: () => {} });
  const require = (id: string) => {
    if (id === "react") return { useRef: () => ({ current: null }) };
    if (id === "react/jsx-runtime") return { jsx: () => null };
    if (id === "@tanstack/react-query") return { useQueryClient: () => ({ fetchQuery: async () => [] }) };
    if (id === "./useUpdateMedia") return { useUpdateMedia: () => ({ isPending: false, mutateAsync: async (input: Record<string, unknown>) => {
      requests.push(input);
      if (input.expected_revision !== revision) throw new Error("stale");
      return { personal_revision: ++revision };
    } }) };
    if (id === "./useMediaView") return { useMediaView: () => null };
    if (id === "../lib/watch-status") return status;
    if (id === "../lib/watchable") return { isWatchableNow };
    if (id.endsWith("/toast")) return { toast };
    if (id.endsWith("/demo-guard")) return { isDemoReadOnlyError: () => false };
    if (id.endsWith("/report-error")) return { reportError: () => {} };
    if (id === "./useWatchingGoals") return { watchingGoalsQuery: () => ({}) };
    return {};
  };
  runInNewContext(js,{ exports,require });
  const media = { id: "media", type: "serie", status: "Returning Series", personal_revision: 3, watched: false,
    in_progress: true, want_to_watch: false, paused: false, dropped: false, favorite: false,
    current_season: 1, current_episode: 1, season_aired: [13], season_episodes: [13], season_years: {}, caught_up_at: null };
  return { actions: exports.useWatchActions(media,null), requests, externalWrite: () => { revision++; } };
}
describe("history action revision propagation", () => {
  it("Undo uses the returned revision despite its old toast closure", async () => {
    const { actions, requests } = actionsHarness();
    const applied = await actions.setPosition(1,2,"viewing");
    expect(applied?.personal_revision).toBe(4);
    expect(await actions.undoPosition(1,1,null,applied?.personal_revision)).not.toBeNull();
    expect(requests.map(r => r.expected_revision)).toEqual([3,4]);
    expect(requests[1].history_intent).toBe("correction");
  });
  it("an old Undo cannot overwrite a subsequent action, even from the same hook", async () => {
    const { actions, requests } = actionsHarness();
    const applied = await actions.setPosition(1,2,"viewing");
    await actions.toggleFavorite();
    expect(await actions.undoPosition(1,1,null,applied?.personal_revision)).toBeNull();
    expect(requests.map(r => r.expected_revision)).toEqual([3,4,4]);
  });
  it("a stale tab cannot silently replace another client's personal state", async () => {
    const { actions,externalWrite } = actionsHarness();
    externalWrite();
    expect(await actions.setPosition(1,2,"viewing")).toBeNull();
  });
});


describe("personal history mutation cache coherence",()=>{
  function harness() {
    const cache=new QueryClient();
    const js=ts.transpileModule(readFileSync("src/modules/watching/hooks/useUpdateMedia.ts","utf8"),{
      compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const exports:Record<string,()=>{onSuccess:(saved:unknown,input:Record<string,unknown>)=>void}>={};
    const require=(id:string)=>{
      if(id==="@tanstack/react-query") return {useMutation:(options:unknown)=>options,useQueryClient:()=>cache};
      if(id==="./query-keys") return {WATCHING_KEYS,PEOPLE_KEYS};
      if(id==="../lib/mutation-dependencies") return dependencies;
      if(id==="@/modules/settings/hooks/useSettings") return {useIsDemo:()=>false};
      if(id==="../lib/sync-goals") return {syncWatchingGoals:async()=>[]};
      if(id==="../lib/sync-habits") return {syncWatchingHabits:async()=>{}};
      return {};
    };
    runInNewContext(js,{exports,require});
    const history=WATCHING_KEYS.history("show"),ratings=[...WATCHING_KEYS.all,"scope-ratings","show"];
    cache.setQueryData(history,{records:[{year:2023}]});
    cache.setQueryData(ratings,[{available_seen:false}]);
    return {cache,history,ratings,success:exports.useUpdateMedia().onSuccess};
  }
  it.each([
    {current_season:2,current_episode:50},
    {watched:true},
    {season_years:{"2":2026}},
    {history_date:{year:2026,month:10,day:28}},
  ])("refreshes shared periods and rating eligibility after %j",patch=>{
    const {cache,history,ratings,success}=harness();
    try {
      success({id:"show",...patch},{id:"show",type:"anime",...patch});
      expect(cache.getQueryState(history)?.isInvalidated).toBe(true);
      expect(cache.getQueryState(ratings)?.isInvalidated).toBe(true);
    } finally {cache.clear();}
  });
  it("refreshes Last Watched and rating rails after a server-side cursor correction",()=>{
    const {cache,success}=harness();
    const recent=WATCHING_KEYS.recentlyWatched("anime"),top=WATCHING_KEYS.topRated("anime");
    cache.setQueryData(recent,[{id:"show",watched_at:"2019-12-31"}]);
    cache.setQueryData(top,[{id:"show",season_ratings:{"3":7.5}}]);
    try {
      success({id:"show",watched_at:null,season_ratings:{}},
        {id:"show",type:"anime",current_season:2,current_episode:12,history_intent:"correction"});
      expect(cache.getQueryState(recent)?.isInvalidated).toBe(true);
      expect(cache.getQueryState(top)?.isInvalidated).toBe(true);
      expect(cache.getQueryData(WATCHING_KEYS.detail("show"))).toEqual({id:"show",watched_at:null,season_ratings:{}});
    } finally {cache.clear();}
  });
  it("leaves history and membership fresh for a notes-only edit",()=>{
    const {cache,history,ratings,success}=harness();
    try {
      success({id:"show"},{id:"show",type:"anime",notes:"Personal note"});
      expect(cache.getQueryState(history)?.isInvalidated).toBe(false);
      expect(cache.getQueryState(ratings)?.isInvalidated).toBe(false);
    } finally {cache.clear();}
  });
});
