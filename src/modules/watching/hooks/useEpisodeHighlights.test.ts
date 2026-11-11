import { beforeEach, expect, it, vi } from "vitest";
const service=vi.hoisted(()=>({getTmdbEpisode:vi.fn(),addEpisodeHighlight:vi.fn()}));
vi.mock("@tanstack/react-query",()=>({useMutation:(options:unknown)=>options,useQuery:vi.fn(),useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock("@/modules/settings/hooks/useSettings",()=>({useIsDemo:()=>false}));
vi.mock("../service",()=>({...service,getEpisodeHighlights:vi.fn(),removeEpisodeHighlight:vi.fn()}));
import { useAddEpisodeHighlight, type EpisodeMeta } from "./useEpisodeHighlights";
type Input={tmdbId:number;userId:string;orgId:string;season:number;episode:number;sourceEpisode:number;meta?:EpisodeMeta};
// eslint-disable-next-line react-hooks/rules-of-hooks -- Contract adapter: useMutation is mocked to return options; no React render occurs.
const mutation=()=>useAddEpisodeHighlight("media") as unknown as {mutationFn:(input:Input)=>Promise<unknown>};
const input:Input={tmdbId:21,userId:"owner",orgId:"org",season:20,episode:1,sourceEpisode:892};
beforeEach(()=>{vi.clearAllMocks();service.getTmdbEpisode.mockResolvedValue({name:"Episode",still_path:null,air_date:"2019-07-07",overview:"Story"});});
it("looks up the absolute provider number while persisting normalized HEGON coordinates",async()=>{
 await mutation().mutationFn(input);
 expect(service.getTmdbEpisode).toHaveBeenCalledWith(21,20,892);
 expect(service.addEpisodeHighlight).toHaveBeenCalledWith(expect.objectContaining({season:20,episode:1,source_episode:892}));
});
it("uses metadata already held by SeasonPanel without another provider request",async()=>{
 await mutation().mutationFn({...input,meta:{title:"Episode",still_path:null,air_date:"2019-07-07",overview:null}});
 expect(service.getTmdbEpisode).not.toHaveBeenCalled();expect(service.addEpisodeHighlight).toHaveBeenCalledWith(expect.objectContaining({episode:1,source_episode:892}));
});
