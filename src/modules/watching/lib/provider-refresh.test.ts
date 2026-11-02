import {describe,expect,it} from "vitest";
import {needsProviderBootstrap} from "../../../../supabase/functions/_shared/provider-refresh";

describe("accepted anime mapping bootstrap",()=>{
  const now=Date.parse("2026-10-29T12:00:00Z"),retry=12*60*60*1000;
  it("seeds missing heads independently of a fresh legacy projection",()=>{
    expect(needsProviderBootstrap(undefined,now,retry)).toBe(true);
    expect(needsProviderBootstrap({accepted_snapshot_id:null,checked_at:null},now,retry)).toBe(true);
  });
  it("backs off failed attempts and leaves accepted catalogues on their normal schedule",()=>{
    expect(needsProviderBootstrap({accepted_snapshot_id:null,checked_at:"2026-10-29T10:00:00Z"},now,retry)).toBe(false);
    expect(needsProviderBootstrap({accepted_snapshot_id:null,checked_at:"2026-10-28T10:00:00Z"},now,retry)).toBe(true);
    expect(needsProviderBootstrap({accepted_snapshot_id:"accepted",checked_at:"2020-01-01"},now,retry)).toBe(false);
  });
});
