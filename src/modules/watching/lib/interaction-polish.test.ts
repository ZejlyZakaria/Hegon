import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as jsx from "react/jsx-runtime";
import type { ReactElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function load<T>(file:string,deps:Record<string,unknown>,expose="") {
  const code=ts.transpileModule(readFileSync(resolve(file),"utf8")+expose,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports:Record<string,unknown>={};
  const blank=()=>null;
  runInNewContext(code,{exports,require:(id:string)=>deps[id]??new Proxy({__esModule:true,default:blank},{get:(t,k)=>t[k as keyof typeof t]??blank})});return exports as T;
}
interface ElementProps { [key:string]:unknown; children?:unknown; onClick?:(event?:{stopPropagation:()=>void})=>void }
function nodes(node:unknown):ReactElement<ElementProps>[] {
  if(Array.isArray(node))return node.flatMap(nodes);
  if(!node||typeof node!=="object"||!("props" in node))return [];
  const el=node as ReactElement<ElementProps>;return [el,...nodes(el.props.children)];
}
const hooks={useState:(value:unknown)=>[value,()=>{}],useRef:()=>({current:null}),useEffect(){}};

describe("Watching interaction consolidation",()=>{
  it("shares the all-time stats ledger while keeping the selected year independent",()=>{
    const source=ts.createSourceFile("StatsPage.tsx",readFileSync(resolve("src/modules/watching/components/stats/StatsPage.tsx"),"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const statements:string[]=[];
    const visit=(n:ts.Node)=>{if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>["stats","allTime"].includes(d.name.getText(source))))statements.push(n.getText(source));ts.forEachChild(n,visit);};visit(source);
    const years:unknown[]=[];const exports:{run?:(year:number|null)=>{stats:unknown;allTime:unknown}}={};
    const code=ts.transpileModule("exports.run=(selectedYear)=>{const data={};"+statements.join("\n")+";return {stats,allTime};}",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    runInNewContext(code,{exports,useMemo:(fn:()=>unknown)=>fn(),computeStats:(_items:unknown,_rewatches:unknown,year:unknown)=>{years.push(year);return {year};}});
    const all=exports.run!(null);expect(years).toEqual([null]);expect(all.stats).toBe(all.allTime);
    years.length=0;const annual=exports.run!(2026);expect(years).toEqual([null,2026]);expect(annual.stats).not.toBe(annual.allTime);
  });
  it.each(["useAddToList","useRemoveFromList"])("%s refreshes membership, list content and thumbnail lists",(name)=>{
    const keys:unknown[]=[];
    const mod=load<Record<string,(...args:string[])=>{onSuccess:(data:unknown,listId:string)=>void}>>("src/modules/watching/hooks/useMediaLists.ts",{
      "@tanstack/react-query":{useQueryClient:()=>({invalidateQueries:({queryKey}:{queryKey:unknown})=>keys.push(queryKey)}),useMutation:(options:unknown)=>options},
      "./query-keys":{WATCHING_KEYS:{all:["watching"],listsForMedia:(id:string)=>["watching","lists-for-media",id],listItems:(id:string)=>["watching","list-items",id]}},
      "@/modules/settings/hooks/useSettings":{useIsDemo:()=>false},
    });
    mod[name]("media","user").onSuccess({},"list");
    expect(keys).toEqual([["watching","lists-for-media","media"],["watching","list-items","list"],["watching","lists"]]);
  });
  it("offers the existing direct-add action beside dismiss, with the correct identity",()=>{
    let dismissed=0;
    const mod=load<{ForYouCard:(props:Record<string,unknown>)=>unknown}>("src/modules/watching/components/sections/ForYouSectionClient.tsx",{
      react:hooks,"react/jsx-runtime":jsx,
      "@/shared/utils/utils":{cn:(...v:unknown[])=>v.filter(x=>typeof x==="string").join(" ")},
      "@/modules/watching/hooks/useImageReveal":{useImageReveal:()=>({loaded:true,instant:true})},
      "@/modules/watching/components/shared/AddMark":{AddMark:"addmark"},
      "@/shared/components/ui/button":{Button:"button"},
    },"\nexport {ForYouCard};");
    const tree=nodes(mod.ForYouCard({item:{id:42,title:"Recommendation",vote_average:0},type:"anime",onClick(){},onDismiss:()=>dismissed++}));
    expect(tree.find(n=>n.type==="addmark")?.props).toMatchObject({tmdbId:42,type:"anime",title:"Recommendation"});
    let stopped=false;tree.find(n=>n.props["aria-label"]==="Not interested")?.props.onClick?.({stopPropagation:()=>stopped=true});
    expect(stopped).toBe(true);expect(dismissed).toBe(1);
  });
  it("uses native keyboard buttons for both table poster and title navigation",()=>{
    let opened=0;
    const mod=load<{TableRow:(props:Record<string,unknown>)=>unknown}>("src/modules/watching/components/lists/ListDetail.tsx",{
      react:hooks,"react/jsx-runtime":jsx,
      "../../hooks/useMediaLists":{useUpdateListItemNote:()=>({})},
      "../../utils":{displayTitle:(m:{title:string})=>m.title},
      "@/shared/utils/utils":{cn:()=>""},
    },"\nexport {TableRow};");
    const tree=nodes(mod.TableRow({item:{media:{title:"Title",type:"film"}},idx:0,listId:"list",onOpen:()=>opened++}));
    const poster=tree.find(n=>n.type==="button"&&n.props["aria-label"]==="Open Title");
    const title=tree.find(n=>n.type==="button"&&nodes(n.props.children).some(c=>c.type==="span"&&c.props.children==="Title"));
    expect(poster?.props.type).toBe("button");expect(title?.props.type).toBe("button");
    poster?.props.onClick?.();title?.props.onClick?.();expect(opened).toBe(2);
  });
});
