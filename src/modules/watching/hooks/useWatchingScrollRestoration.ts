"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

/** Watching scrolls inside main, which the router's window restoration does not own. */
export function useWatchingScrollRestoration(pathname:string) {
  const content=useRef<HTMLDivElement>(null);
  const positions=useRef(new Map<string,number>());
  const returning=useRef(false);
  useEffect(()=>{
    const onPop=()=>{returning.current=true;};
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  useLayoutEffect(()=>{
    const main=document.querySelector("main");
    if(!main) return;
    const target=returning.current ? positions.current.get(pathname) ?? 0 : 0;
    returning.current=false;
    let restoring=true, firstFrame=false;
    const restore=()=>{
      main.scrollTop=target;
      if(firstFrame && Math.abs(main.scrollTop-target)<1) restoring=false;
    };
    restore();
    // Finish after router focus effects, still before the first paint.
    const frame=requestAnimationFrame(()=>{firstFrame=true;restore();});
    // A cached route normally restores immediately. If a skeleton is shorter, wait for content.
    const observer=new ResizeObserver(()=>{if(restoring) restore();});
    if(content.current) observer.observe(content.current);
    const save=()=>{if(!restoring) positions.current.set(pathname,main.scrollTop);};
    const interrupt=()=>{restoring=false;};
    main.addEventListener("scroll",save,{passive:true});
    main.addEventListener("touchstart",interrupt,{passive:true});
    main.addEventListener("wheel",interrupt,{passive:true});
    return ()=>{
      cancelAnimationFrame(frame);
      observer.disconnect();
      main.removeEventListener("scroll",save);
      main.removeEventListener("touchstart",interrupt);
      main.removeEventListener("wheel",interrupt);
    };
  },[pathname]);
  return content;
}
