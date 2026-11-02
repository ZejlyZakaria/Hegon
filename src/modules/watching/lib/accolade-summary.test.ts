import { describe, expect, it } from "vitest";
import { externalAwardSummary, featuredAccolade } from "./accolade-summary";
import type { AwardCategory, AwardEntry } from "../types";
describe("award summary scope",()=>{
  it("keeps an external headline separate from its across-all-awards totals",()=>{
    expect(externalAwardSummary("Won 16 Primetime Emmys. 172 wins & 298 nominations total.")).toEqual({additional:false,wins:172,nominations:298,headline:{won:true,count:16,name:"Emmys"}});
    expect(externalAwardSummary("Nominated for 53 Primetime Emmys.")).toEqual({additional:false,wins:null,nominations:null,headline:{won:false,count:53,name:"Emmys"}});
    expect(externalAwardSummary("Won 1 Oscar. Another 10 wins & 8 nominations.")).toMatchObject({additional:true,wins:10});
    expect(externalAwardSummary("N/A")).toBeNull();
  });
  it("features only wins in the same stable category and ceremony, with their own actual years",()=>{
    const rows=[{key:"a",category:"drama",ceremony:"emmys",won:true,year:2014},{key:"b",category:"drama",ceremony:"emmys",won:true,year:2013},{key:"c",category:"actor",ceremony:"emmys",won:true,year:2015},{key:"d",category:"drama",ceremony:"emmys",won:false,year:2012}] as AwardEntry[];
    const cats=new Map([["drama",{label:"Outstanding Drama Series",rank:1} as AwardCategory],["actor",{label:"Lead Actor",rank:2} as AwardCategory]]);
    expect(featuredAccolade(rows,cats)).toEqual({label:"Outstanding Drama Series",count:2,years:"2013, 2014"});
    expect(featuredAccolade(rows.filter(r=>!r.won),cats)).toBeNull();
  });
});
