import { describe, expect, it } from "vitest";
import { positionPatch, preserveCorrectionStance, resumePatch, type StatusFacts } from "./watch-status";
const base = {type:"serie",status:"ended",watched:false,in_progress:false,paused:false,dropped:false,favorite:false,
  current_season:2,current_episode:4,season_aired:[5,5],season_episodes:[5,5],season_years:{"1":2020,"2":2021},caught_up_at:null} as StatusFacts;

describe("progress corrections retain explicit suspension",()=>{
  for (const type of ["serie","anime"] as const) for (const stance of ["paused","dropped"] as const) {
    it.each([[1,3],[2,5]] as const)(`${type}/${stance}: correcting to S%s EP%s does not resume, complete or date`,(season,episode)=>{
      const before={...base,type,[stance]:true,drop_reason:stance === "dropped" ? "lost_interest":null};
      const patch=positionPatch(before,season,episode,"correction");
      expect({...before,...patch}).toMatchObject({[stance]:true,watched:false,in_progress:false,drop_reason:before.drop_reason});
      for (const key of ["watched_at","last_watched_at","season_years","cour_years"]) expect(patch).not.toHaveProperty(key);
    });
  }
  it("defends the service against old UI patches while leaving non-progress edits and explicit resume intact",()=>{
    const before={paused:false,dropped:true,drop_reason:"lost_interest"};
    const old={current_episode:5,watched:true,in_progress:true,dropped:false,drop_reason:null,watched_at:"2026-11-02",last_watched_at:"2026-11-02"};
    const kept=preserveCorrectionStance(before,old,"correction");
    expect(kept).toMatchObject({watched:false,in_progress:false,dropped:true,drop_reason:"lost_interest"});
    expect(kept).not.toHaveProperty("last_watched_at");expect(old.watched).toBe(true);
    const rating={user_rating:9};expect(preserveCorrectionStance(before,rating,"correction")).toBe(rating);
    expect(preserveCorrectionStance(before,resumePatch(),"claim")).toEqual({paused:false,dropped:false,drop_reason:null,in_progress:true,watched:false,resume_required:false});
  });
});
