import { describe,it,expect } from "vitest";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { WatchingCompletionStatus } from "@/modules/goals/components/WatchingCompletionStatus";
import type { Goal } from "@/modules/goals/types";
import type { WatchingAchievement } from "../components/stats/achievements";

describe("Receipt UI keeps historical status separate from live progress",()=>{
  it("renders the actual achievement panel below its historical unlock threshold",()=>{
    const exports:Record<string,unknown>={};
    const compiled=ts.transpileModule(readFileSync("src/modules/watching/components/stats/AchievementPanel.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    const placeholder=()=>null;
    const dependencies:Record<string,unknown>={react:React,"react/jsx-runtime":jsx,
      "@/shared/components/ui/sliding-panel":{SlidingPanel:({children}:{children:React.ReactNode})=>React.createElement("div",null,children)},
      "@/shared/components/achievements/AchievementGrid":{ACHIEVEMENT_ICONS:{clapperboard:placeholder}},
      "@/shared/utils/utils":{cn:(...args:string[])=>args.join(" ")}};
    runInNewContext(compiled,{exports,require:(id:string)=>dependencies[id] ?? new Proxy({}, {get:()=>placeholder})});
    const achievement={key:"cinephile",name:"Cinephile",description:"Watch350 films",icon:"clapperboard",color:"#2dd4bf",unlocked:true,progress:349/350,
      progressLabel:"Current:349/350",detail:{shape:"count",value:349,goal:350,unit:"titles",formula:"Current count",groups:[],candidates:[],remaining:1,
        receiptObserved:true,unlockedAt:"2026-10-21T10:00:00Z"}} as WatchingAchievement;
    const Panel=exports.AchievementPanel as React.ComponentType<{a:WatchingAchievement;open:boolean;onClose:()=>void}>;
    const html=renderToStaticMarkup(React.createElement(Panel,{a:achievement,open:true,onClose(){}}));
    expect(html).toContain("Unlocked / first observed satisfied");expect(html).toContain("Current progress: 349 / 350");expect(html).toContain("2026");
  });
  it("shows completed with49/50 rather than reopening the Goal",()=>{
    const goal={metric_module:"watching",status:"completed",metric_target:50} as Goal;
    expect(renderToStaticMarkup(React.createElement(WatchingCompletionStatus,{goal,current:49}))).toContain("Historically completed. Current progress: 49 / 50");
    expect(renderToStaticMarkup(React.createElement(WatchingCompletionStatus,{goal:{...goal,status:"active"},current:49}))).toBe("");
  });
});
