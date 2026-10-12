import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as status from "./watch-status";

// Execute the real hook with React/transport boundaries supplied by the harness.
// Database semantics are tested separately against real PostgreSQL, never a mocked DB.
function actionsHarness() {
  let revision = 3;
  const requests: Array<Record<string, unknown>> = [];
  const source = readFileSync("src/modules/watching/hooks/useWatchActions.tsx","utf8");
  const js = ts.transpileModule(source,{ compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, (media: unknown, view: unknown) => Record<string, (...args: unknown[]) => Promise<Record<string, unknown> | null>>> = {};
  const toast = Object.assign(() => {},{ error: () => {}, custom: () => {} });
  const require = (id: string) => {
    if (id === "react") return { useRef: () => ({ current: null }) };
    if (id === "react/jsx-runtime") return { jsx: () => null };
    if (id === "@tanstack/react-query") return { useQueryClient: () => ({ fetchQuery: async () => [] }) };
    if (id === "./useUpdateMedia") return { useUpdateMedia: () => ({ isPending: false, mutateAsync: async (input: Record<string, unknown>) => {
      requests.push(input);
      if (input.expected_revision !== revision) throw new Error("stale");
      return { personal_revision: ++revision };
    } }) };
    if (id === "./useMediaView") return { useMediaView: () => null };
    if (id === "../lib/watch-status") return status;
    if (id.endsWith("/toast")) return { toast };
    if (id.endsWith("/demo-guard")) return { isDemoReadOnlyError: () => false };
    if (id.endsWith("/report-error")) return { reportError: () => {} };
    if (id === "./useWatchingGoals") return { watchingGoalsQuery: () => ({}) };
    return {};
  };
  runInNewContext(js,{ exports,require });
  const media = { id: "media", type: "serie", status: "Returning Series", personal_revision: 3, watched: false,
    in_progress: true, want_to_watch: false, paused: false, dropped: false, favorite: false,
    current_season: 1, current_episode: 1, season_aired: [13], season_episodes: [13], season_years: {}, caught_up_at: null };
  return { actions: exports.useWatchActions(media,null), requests, externalWrite: () => { revision++; } };
}
describe("history action revision propagation", () => {
  it("Undo uses the returned revision despite its old toast closure", async () => {
    const { actions, requests } = actionsHarness();
    const applied = await actions.setPosition(1,2,"viewing");
    expect(applied?.personal_revision).toBe(4);
    expect(await actions.undoPosition(1,1,null,applied?.personal_revision)).not.toBeNull();
    expect(requests.map(r => r.expected_revision)).toEqual([3,4]);
    expect(requests[1].history_intent).toBe("correction");
  });
  it("an old Undo cannot overwrite a subsequent action, even from the same hook", async () => {
    const { actions, requests } = actionsHarness();
    const applied = await actions.setPosition(1,2,"viewing");
    await actions.toggleFavorite();
    expect(await actions.undoPosition(1,1,null,applied?.personal_revision)).toBeNull();
    expect(requests.map(r => r.expected_revision)).toEqual([3,4,4]);
  });
  it("a stale tab cannot silently replace another client's personal state", async () => {
    const { actions,externalWrite } = actionsHarness();
    externalWrite();
    expect(await actions.setPosition(1,2,"viewing")).toBeNull();
  });
});
