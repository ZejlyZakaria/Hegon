import {describe,it,expect,vi,beforeEach} from "vitest";
import type {ScopeRatingContext} from "../lib/scope-ratings";
import {useScopeRatings} from "./useScopeRatings";
const state=vi.hoisted(()=>({data:[] as ScopeRatingContext[],pending:false,command:undefined as undefined|Record<string,unknown>}));
vi.mock("@tanstack/react-query",()=>({useQuery:()=>({data:state.data}),useQueryClient:()=>({}),useMutation:()=>({isPending:state.pending,variables:state.command,mutateAsync:vi.fn()})}));
vi.mock("@/modules/settings/hooks/useSettings",()=>({useIsDemo:()=>false}));
vi.mock("../service",()=>({getScopeRatingContext:vi.fn(),saveScopeRating:vi.fn()}));
const context=(id:number):ScopeRatingContext=>({kind:"COUR",number:id,scope_key:`anilist-cour:${id}`,rating_id:`receipt-${id}`,score:7,validity:"CURRENT",covered_episodes:4,provider_snapshot_id:"snap",mapping_snapshot_id:"map",available_episodes:4,range_start:1,range_end:4});
beforeEach(()=>{state.data=[context(501),context(502)];state.pending=false;state.command=undefined;});
describe("Scoped rating saving preview",()=>{
 it("previews only the selected stable identity and leaves other parts and receipts intact",()=>{
  state.pending=true;state.command={scope_kind:"COUR",expected_scope_key:"anilist-cour:501",score:9};
  const result=useScopeRatings("owned");
  expect(result.data?.[0].score).toBe(9);
  expect(result.data?.[0].rating_id).toBe("receipt-501");
  expect(result.data?.[1]).toBe(state.data[1]);
  expect(state.data[0].score).toBe(7);
  expect(result.isSaving).toBe(true);
 });
 it("drops a failed preview without mutating the canonical cache",()=>{
  state.pending=true;state.command={scope_kind:"COUR",expected_scope_key:"anilist-cour:501",score:9};
  expect(useScopeRatings("owned").data?.[0].score).toBe(9);
  state.pending=false;
  expect(useScopeRatings("owned").data?.[0].score).toBe(7);
 });
 it("never applies a preview to a remapped cour sharing the same ordinal",()=>{
  state.pending=true;state.command={scope_kind:"COUR",scope_number:501,expected_scope_key:"anilist-cour:999",score:10};
  expect(useScopeRatings("owned").data?.[0]).toBe(state.data[0]);
 });
});
