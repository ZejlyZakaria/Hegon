import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { WatchingMedia } from "../../types";
const state=vi.hoisted(()=>({data:[] as unknown[],isLoading:false,isError:true,isFetching:false,refetch:vi.fn()}));
vi.mock("../../hooks/useAnimeThemes",()=>({useAnimeThemes:()=>state}));
vi.mock("../../hooks/useThemeCovers",()=>({useThemeCovers:()=>({data:undefined})}));
vi.mock("../../hooks/useThemeFavorites",()=>({useThemeFavorites:()=>({data:[]}),useToggleThemeFavorite:()=>({mutate:vi.fn()})}));
import { AnimeThemes } from "./AnimeThemes";
const media={id:"anime",type:"anime",title:"Hunter x Hunter",year:2011,tmdb_id:1,poster_url:null} as WatchingMedia;
it("keeps the detail surface renderable with a discreet recovery action during an outage",()=>{
 state.isError=true;state.data=[];
 const html=renderToStaticMarkup(createElement(AnimeThemes,{media}));
 expect(html).toContain("Openings &amp; Endings");expect(html).toContain("temporarily unavailable");expect(html).toContain("Try again");
});
it("does not show a fake outage for a genuinely empty catalogue",()=>{
 state.isError=false;state.data=[];
 expect(renderToStaticMarkup(createElement(AnimeThemes,{media}))).toBe("");
});
it("keeps cached tracks playable during a failed background refresh",()=>{
 state.isError=true;state.data=[{name:"Hunter x Hunter",year:2011,tracks:[{id:1,label:"OP1",type:"OP",title:"Departure",artist:"Artist",audioUrl:"https://a.test/song.ogg",videoUrl:null,cover:null}]}];
 const html=renderToStaticMarkup(createElement(AnimeThemes,{media}));expect(html).toContain("Departure");expect(html).not.toContain("temporarily unavailable");
});
