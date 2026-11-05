import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { STALE } from "@/shared/lib/stale";
import { queryReadState, type ReadQuery } from "./query-read-state";

const query = (patch: Partial<ReadQuery> = {}): ReadQuery => ({data:[],isLoading:false,isError:false,refetch:vi.fn(async()=>({})),...patch});
describe("read readiness and error presentation",()=>{
  it("distinguishes a real empty collection from an unreadable one",()=>{
    expect(queryReadState([query()])).toMatchObject({loading:false,blocked:false,stale:false});
    expect(queryReadState([query({data:undefined,isError:true})])).toMatchObject({loading:false,blocked:true,stale:false});
  });
  it("keeps cached data usable after refetch failure and retries only failed queries",async()=>{
    const good=query(),cached=query({data:["kept"],isError:true});const state=queryReadState([good,cached]);
    expect(state).toMatchObject({blocked:false,stale:true});state.retry();
    expect(good.refetch).not.toHaveBeenCalled();expect(cached.refetch).toHaveBeenCalledOnce();
  });
  it("does not let an optional shelf query block independent category readiness",()=>{
    const base=[query(),query(),query()],shelf=query({data:undefined,isLoading:true});
    expect(queryReadState(base).loading).toBe(false);expect(queryReadState([shelf]).loading).toBe(true);
  });
  it("does not replace cached results with loading placeholders during a real background read",async()=>{
    const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:STALE.DAY}}});
    const key=["test","cached-read"];client.setQueryData(key,["kept"]);let release!:(data:string[])=>void;
    const observer=new QueryObserver(client,{queryKey:key,queryFn:()=>new Promise<string[]>(resolve=>{release=resolve;})});
    const unsubscribe=observer.subscribe(()=>{});const pending=observer.refetch();
    expect(queryReadState([observer.getCurrentResult()])).toMatchObject({loading:false,blocked:false,stale:false});
    expect(observer.getCurrentResult().data).toEqual(["kept"]);release(["new"]);await pending;unsubscribe();client.clear();
  });
});
