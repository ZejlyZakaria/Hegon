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
const topTen = flags({ watched: true, priority: 1 });
const inProgress = flags({ in_progress: true });
const wantToWatch = flags({ want_to_watch: true });
const paused = flags({ paused: true });
const dropped = flags({ dropped: true });

/**
 * RECENTLY WATCHED IS A CONSEQUENCE OF HAVING FINISHED SOMETHING.
 *
 * The banner used to infer the outcome from the door you came through — the same line we deleted
 * from the write path (`watched = listContext === …`), surviving in the sentences. It congratulated
 * you on finishing House of the Dragon, a show that is still airing. Making the sentence honest was
 * only half of it: the door itself is called "Add to Recently Watched", and the name of a door is a
 * promise. A title that cannot be `watched` cannot be recently watched, so the door is shut.
 */
describe("resolveTransition — Recently Watched refuses what it cannot hold", () => {
  const airing = { type: "serie" as const, status: "ongoing" };
  const over = { type: "serie" as const, status: "ended" };

  it("refuses an ongoing series you already own", () => {
    const t = resolveTransition(inProgress, "recentlyWatched", airing);
    expect(t.allowed).toBe(false);
    expect(t.action).toBe("blocked");
    expect(t.message).toMatch(/isn't over yet/i);
  });

  it("refuses an ongoing series you DON'T own yet — the same lie, told about a new title", () => {
    const t = resolveTransition(null, "recentlyWatched", airing);
    expect(t.allowed).toBe(false);
    expect(t.message).toMatch(/still airing/i);
  });

  it("accepts a series that is really over, and calls it what it is: a completion", () => {
    const t = resolveTransition(inProgress, "recentlyWatched", over);
    expect(t.allowed).toBe(true);
    expect(t.message).toMatch(/marks it as finished/i);
  });

  it("lets a film through, always — a film is binary", () => {
    expect(resolveTransition(null, "recentlyWatched", { type: "film", status: null }).allowed).toBe(true);
  });

  it("RANKING IS NOT WATCHING — the Top 10 stays open to a show that is still airing", () => {
    const t = resolveTransition(inProgress, "topTen", airing);
    expect(t.allowed).toBe(true);
    expect(t.message).not.toMatch(/you finished this one/i);
  });

  it("never blocks on ignorance — a caller that omits the facts keeps the old behaviour", () => {
    expect(resolveTransition(inProgress, "recentlyWatched").allowed).toBe(true);
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

  it("recognises library membership (watched, no priority)", () => {
    const t = resolveTransition(library, "library");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain('"Library"');
  });

  // Recently Watched is a VIEW now, not a bucket. A watched title's legacy `recently_watched`
  // flag must not change how the resolver sees it: it is simply in your Library, either way.
  it("ignores the deprecated recently_watched flag — a watched title is Library, flag or not", () => {
    const flagged = resolveTransition(flags({ watched: true, recently_watched: true }), "library");
    const plain = resolveTransition(flags({ watched: true, recently_watched: false }), "library");
    expect(flagged).toEqual(plain);
    expect(flagged.message).toContain('"Library"');
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
  it("blocks pushing a watched title back to want to watch", () => {
    const t = resolveTransition(library, "wantToWatch");
    expect(t.allowed).toBe(false);
  });

  it("blocks pushing a top 10 item back to want to watch", () => {
    const t = resolveTransition(topTen, "wantToWatch");
    expect(t.allowed).toBe(false);
  });

  it("blocks moving a top 10 item down to the plain library", () => {
    const t = resolveTransition(topTen, "library");
    expect(t.allowed).toBe(false);
    expect(t.message).toContain("not allowed");
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
