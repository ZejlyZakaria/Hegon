import { describe,it,expect } from "vitest";
import { activitySlots,ratingDistributionPlot } from "./stats-charts";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const distribution=(counts:number[])=>counts.map((count,index)=>({score:index+1,count}));
function card(name:string,props:Record<string,unknown>) {
  const source=ts.createSourceFile("StatsPage.tsx",readFileSync("src/modules/watching/components/stats/StatsPage.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const declaration=source.statements.find(s=>ts.isFunctionDeclaration(s) && s.name?.text===name)!;
  const code=`const TEAL="#2dd4bf";${declaration.getText(source)};exports.Card=${name};`;
  const exports:{Card?:React.ComponentType<Record<string,unknown>>}={};
  runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,require:()=>jsx,activitySlots,ratingDistributionPlot,Star:()=>null,CalendarDays:()=>null});
  return renderToStaticMarkup(React.createElement(exports.Card!,props));
}
describe("Activity calendar positions",()=>{
  it.each([2021,2022,2023,2026])("keeps all12 months for%s and preserves actual event counts",year=>{
    const slots=activitySlots([{label:`${year}-02`,count:2},{label:`${year}-12`,count:7}],year);
    expect(slots).toHaveLength(12);expect(slots[0]).toEqual({label:`${year}-01`,count:0});
    expect(slots[1].count).toBe(2);expect(slots[11].count).toBe(7);
    expect(slots.reduce((n,a)=>n+a.count,0)).toBe(9);
  });
  it("does not pretend an undated year has monthly precision or change the all-time year axis",()=>{
    expect(activitySlots([],2022)).toEqual([]);
    expect(activitySlots([{label:"2022",count:5}],null)).toEqual([{label:"2022",count:5}]);
  });
  it("renders the actual Activity card with12 positions and readable zero-month values",()=>{
    const html=card("ActivityCard",{activity:[{label:"2022-03",count:2}],selectedYear:2022});
    expect(html).toContain('aria-label="2022-01: 0 activities"');
    expect(html).toContain('aria-label="2022-03: 2 activities"');
    expect(html).toContain('aria-label="2022-12: 0 activities"');
  });
});
describe("Rating distribution geometry and actual card",()=>{
  it.each([[0,0,1,0,4,2,6,4,8,3],[0,0,0,0,0,1,6,2,0,0],[0,0,0,0,0,0,0,0,0,1]].map(counts=>({counts})))("bounds every curve segment and aligns labels to actual scores $counts",({counts})=>{
    const plot=ratingDistributionPlot(distribution(counts));
    for(const s of plot.segments) for(let step=0;step<=100;step++){
      const t=step/100,u=1-t;
      const x=u*u*u*s.from.x+3*u*u*t*s.c1.x+3*u*t*t*s.c2.x+t*t*t*s.to.x;
      const y=u*u*u*s.from.y+3*u*u*t*s.c1.y+3*u*t*t*s.c2.y+t*t*t*s.to.y;
      expect(x).toBeGreaterThanOrEqual(s.from.x-1e-8);expect(x).toBeLessThanOrEqual(s.to.x+1e-8);
      expect(y).toBeGreaterThanOrEqual(Math.min(s.from.y,s.to.y)-1e-8);expect(y).toBeLessThanOrEqual(Math.max(s.from.y,s.to.y)+1e-8);
    }
    const html=card("RatingDistributionCard",{distribution:distribution(counts)});
    for(const point of plot.labels) expect(html).toContain(`left:${point.x/plot.width*100}%`);
    for(const point of plot.points) if(point.count)expect(html).toContain(`cx="${point.x}"`);
    expect(plot.points.at(-1)?.score).toBe(plot.maxScore);expect(plot.maxScore).toBeLessThanOrEqual(10);
    expect(plot.linePath).not.toContain("NaN");
  });
  it("supports an empty distribution and a single rating at10",()=>{
    expect(ratingDistributionPlot(distribution(Array(10).fill(0))).total).toBe(0);
    const p=ratingDistributionPlot([{score:10,count:2}]);
    expect(p.points).toEqual([{score:10,count:2,x:100,y:6}]);
    expect(p.segments).toEqual([]);
  });
});

it("positions fractional ratings on their real numeric scale without rounding the maximum up",()=>{
  const distribution=[{score:6.5,count:1},{score:7,count:2},{score:8.75,count:3}];
  const p=ratingDistributionPlot(distribution);
  expect(p.minScore).toBe(6.5);expect(p.maxScore).toBe(8.75);
  expect(p.points[1].x).toBeCloseTo(8+0.5/2.25*184);
  const html=card("RatingDistributionCard",{distribution});
  expect(html).toContain("8.75");expect(html).not.toContain(">9</span>");
  expect(p.points.at(-1)?.x).toBe(192);
});
