import { describe, it, expect } from "vitest";
import { resolveTransition, type MediaStateFlags } from "./resolve-transition";

function flags(o: Partial<MediaStateFlags> = {}): MediaStateFlags {
  return {
    watched: false,
    recently_watched: false,
    priority: null,
    in_progress: false,
    want_to_watch: false,
    ...o,
  };
}

// Membership shorthands used across the suite.
const library = flags({ watched: true });
const recentlyWatched = flags({ watched: true, recently_watched: true });
const topTen = flags({ watched: true, priority: 1 });
const inProgress = flags({ in_progress: true });
const wantToWatch = flags({ want_to_watch: true });
const paused = flags({ paused: true });
const dropped = flags({ dropped: true });

// THE BANNER USED TO INFER THE OUTCOME FROM THE DOOR YOU CAME THROUGH — the same line we deleted
// from the write path (`watched = listContext === …`), surviving in the sentences. So the modal
// congratulated you on finishing House of the Dragon, a show that is still airing.
describe("resolveTransition — it must not assert a completion it cannot know", () => {
  const airing = flags({ in_progress: true, type: "serie", status: "ongoing" });
  const over = flags({ in_progress: true, type: "serie", status: "ended" });

  // The assertion is about the CLAIM, not the word: "titles you've finished" describes the rail,
  // which is fair. "You finished this one!" attributes the completion to you, which is the lie.
  const claimsCompletion = /you finished this one/i;

  it("does NOT tell you that you finished a series that is still airing", () => {
    const t = resolveTransition(airing, "recentlyWatched");
    expect(t.allowed).toBe(true);
    expect(t.message).not.toMatch(claimsCompletion);
    expect(t.message).toMatch(/still airing/i);
  });

  it("says so plainly when the show really is over", () => {
    expect(resolveTransition(over, "recentlyWatched").message).toMatch(claimsCompletion);
  });

  it("ranking is not watching — the Top 10 stops declaring a running show finished", () => {
    expect(resolveTransition(airing, "topTen").message).not.toMatch(claimsCompletion);
    expect(resolveTransition(over, "topTen").message).toMatch(claimsCompletion);
  });

  it("a caller that omits the facts keeps the old behaviour rather than crashing", () => {
    expect(resolveTransition(inProgress, "recentlyWatched").message).toMatch(claimsCompletion);
  });
});

describe("resolveTransition — no existing entry", () => {
  it("is a clean insert with no banner", () => {
    const t = resolveTransition(null, "wantToWatch");
    expect(t).toEqual({ allowed: true, action: "insert", message: null, existingLists: [] });
  });
});

describe("resolveTransition — already in target", () => {
  it("blocks re-adding to the same list", () => {
    const t = resolveTransition(wantToWatch, "wantToWatch");
    expect(t.allowed).toBe(false);
    expect(t.action).toBe("blocked");
    expect(t.message).toContain("already in");
  });

  it("recognises library membership (watched, not recently, no priority)", () => {
    const t = resolveTransition(library, "library");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain('"Library"');
  });
});

describe("resolveTransition — paused / dropped are already in the collection", () => {
  it("blocks re-adding a paused title to any list, with a collection banner", () => {
    const t = resolveTransition(paused, "library");
    expect(t.allowed).toBe(false);
    expect(t.action).toBe("blocked");
    expect(t.message).toContain("paused");
    expect(t.existingLists).toContain("Paused");
  });

  it("blocks re-adding a dropped title (even to In Progress)", () => {
    const t = resolveTransition(dropped, "inProgress");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain("dropped");
    expect(t.existingLists).toContain("Dropped");
  });
});

describe("resolveTransition — allowed contextual transitions", () => {
  it("in progress → top 10 ranks the finished item", () => {
    const t = resolveTransition(inProgress, "topTen");
    expect(t.allowed).toBe(true);
    expect(t.action).toBe("update:topTen");
    expect(t.message).toContain("Top 10");
  });

  it("library → recently watched is an allowed merge", () => {
    const t = resolveTransition(library, "recentlyWatched");
    expect(t.allowed).toBe(true);
    expect(t.action).toBe("update:merge");
    expect(t.message).toContain("Recently Watched");
  });

  it("want to watch → in progress starts the item", () => {
    const t = resolveTransition(wantToWatch, "inProgress");
    expect(t.allowed).toBe(true);
    expect(t.action).toBe("update:inProgress");
  });

  it("enriches the banner with the existing rating when present", () => {
    const t = resolveTransition(flags({ watched: true, user_rating: 8 }), "topTen");
    expect(t.message).toContain("(rated 8/10)");
  });
});

describe("resolveTransition — explicit blocks", () => {
  it("in progress → want to watch is not allowed", () => {
    const t = resolveTransition(inProgress, "wantToWatch");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain("In Progress");
  });

  it("want to watch → recently watched points to the Mark as watched button", () => {
    const t = resolveTransition(wantToWatch, "recentlyWatched");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain("Mark as watched");
  });
});

describe("resolveTransition — forbidden combinations", () => {
  it("blocks moving a recently watched item into the library", () => {
    const t = resolveTransition(recentlyWatched, "library");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain("not allowed");
  });

  it("blocks pushing a top 10 item back to want to watch", () => {
    const t = resolveTransition(topTen, "wantToWatch");
    expect(t.allowed).toBe(false);
  });
});

describe("resolveTransition — clean merge", () => {
  it("allows a reference-only entry (no flags) into want to watch with no banner", () => {
    const t = resolveTransition(flags(), "wantToWatch");
    expect(t.allowed).toBe(true);
    expect(t.action).toBe("update:merge");
    expect(t.message).toBeNull();
  });
});

describe("resolveTransition — action mapping", () => {
  it("maps each target onto its write branch", () => {
    expect(resolveTransition(library, "inProgress").action).toBe("update:inProgress");
    expect(resolveTransition(library, "topTen").action).toBe("update:topTen");
    expect(resolveTransition(library, "recentlyWatched").action).toBe("update:merge");
  });
});
