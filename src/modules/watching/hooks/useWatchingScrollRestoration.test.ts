import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
function harness(){
 const refs:{current:unknown}[]=[];let cursor=0,layout:(()=>void)|undefined,cleanup:(()=>void)|undefined,resize=()=>{},frame=()=>{},top=0,height=3000;
 const listeners=new Map<string,()=>void>(),windowListeners=new Map<string,()=>void>();
 const main={get scrollTop(){return top;},set scrollTop(n:number){top=Math.min(n,height-500);},addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
 const exports={} as {useWatchingScrollRestoration:(path:string)=>{current:unknown}};
 const source=ts.transpileModule(readFileSync("src/modules/watching/hooks/useWatchingScrollRestoration.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(source,{exports,document:{querySelector:()=>main},window:{addEventListener:(name:string,fn:()=>void)=>windowListeners.set(name,fn),removeEventListener:()=>{}},requestAnimationFrame:(fn:()=>void)=>{frame=fn;return 1;},cancelAnimationFrame:()=>{},ResizeObserver:class{constructor(fn:()=>void){resize=fn;}observe(){}disconnect(){}},require:(id:string)=>{
  if(id!=="react")throw Error(id);
  return {useRef:(initial:unknown)=>refs[cursor++]??(refs[cursor-1]={current:initial}),useEffect:(fn:()=>void)=>{if(!windowListeners.has("popstate"))fn();},useLayoutEffect:(fn:()=>()=>void)=>{layout=()=>{cleanup=fn();};}};
 }});
 const render=(path:string)=>{cleanup?.();cursor=0;const content=exports.useWatchingScrollRestoration(path);content.current={};layout?.();};
 return {render,frame:()=>frame(),resize:(next:number)=>{height=next;resize();},scroll:(n:number)=>{main.scrollTop=n;listeners.get("scroll")?.();},pop:()=>windowListeners.get("popstate")?.(),touch:()=>listeners.get("touchstart")?.(),get top(){return top;}};
}
describe("Watching nested main scroll restoration",()=>{
 it("opens a new detail at the top and restores Back after a shorter skeleton grows",()=>{
  const h=harness();h.render("movies");h.frame();h.scroll(1800);
  h.render("film");expect(h.top).toBe(0);h.frame();h.scroll(700);
  h.pop();h.resize(600);h.render("movies");h.frame();expect(h.top).toBe(100);
  h.resize(3000);expect(h.top).toBe(1800);
  h.pop();h.render("film");h.frame();expect(h.top).toBe(700);
 });
 it("lets a deliberate user gesture cancel deferred restoration",()=>{
  const h=harness();h.render("movies");h.frame();h.scroll(1800);h.render("film");h.frame();
  h.pop();h.resize(600);h.render("movies");h.frame();h.touch();h.scroll(40);h.resize(3000);expect(h.top).toBe(40);
 });
});
