import { describe, expect, it } from "vitest";
import { railGeometry } from "./rail-navigation";
describe("card-aligned rail geometry", () => {
  it.each([358,736,640,920])("keeps episode targets on full cards at viewport %s", viewport => {
    const offsets=Array.from({length:12},(_,i)=>i*276);
    const g=railGeometry(offsets,264,viewport,16);
    expect(g.targets[0]).toBe(0);
    expect(g.targets.slice(0,-1).every(t=>offsets.includes(t))).toBe(true);
    expect(g.targets.at(-1)).toBe(offsets.at(-1)!+264-(viewport-32));
    expect(g.page).toBeGreaterThanOrEqual(1);
  });
  it("does not invent overflow for short rails", () => {
    expect(railGeometry([0,156],144,900,6)).toMatchObject({targets:[0]});
  });
});

it("ends a 65percent list rail on the last card's right edge without a spacer",()=>{
  const g=railGeometry([0,207],195,300,0);
  expect(g.targets).toEqual([0,102]);
});
