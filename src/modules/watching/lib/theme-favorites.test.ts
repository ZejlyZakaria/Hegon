import { afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { getThemeFavorites, removeThemeFavorite } from "../service";
import { WATCHING_KEYS } from "../hooks/query-keys";
afterEach(()=>vi.unstubAllEnvs());
it("reads and removes favorites only in the requested workspace, preserving the other workspace",async()=>{
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://themes-test.supabase.co");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test-key");
 const queries:{method:string;org:string|null;track:string|null}[]=[];
 server.use(http.all("https://themes-test.supabase.co/rest/v1/theme_favorites",({request})=>{
  const url=new URL(request.url);queries.push({method:request.method,org:url.searchParams.get("org_id"),track:url.searchParams.get("track_key")});
  return request.method==="DELETE"?new HttpResponse(null,{status:204}):HttpResponse.json([]);
 }));
 await getThemeFavorites("workspace-a");await removeThemeFavorite("air|op1|opening","workspace-a");
 expect(queries).toEqual([{method:"GET",org:"eq.workspace-a",track:null},{method:"DELETE",org:"eq.workspace-a",track:"eq.air|op1|opening"}]);
 expect(WATCHING_KEYS.themeFavorites("workspace-a")).not.toEqual(WATCHING_KEYS.themeFavorites("workspace-b"));
});
