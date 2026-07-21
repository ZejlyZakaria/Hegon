import { describe, expect, it } from "vitest";
import { ownedRowFor, type OwnedMap } from "./possession";

// You own the SERIES Game of Thrones. TMDB id 1399 is also a (different) film.
const owned: OwnedMap = {
  1399: { id: "row-got", type: "serie" },
  94997: { id: "row-hotd", type: "serie" },
  372058: { id: "row-your-name", type: "film" },
  1735: { id: "row-naruto", type: "anime" },
};

describe("ownedRowFor", () => {
  it("matches a tv result against the series you own", () => {
    expect(ownedRowFor({ id: 94997, media_type: "tv" }, owned)).toEqual({ id: "row-hotd", type: "serie" });
  });

  it("matches a tv result against an ANIME row — our own type is not part of the question", () => {
    // This is why possession is never filtered on our film/serie/anime type: it is guessed from
    // genres, and a title stored under the "wrong" one is still yours.
    expect(ownedRowFor({ id: 1735, media_type: "tv" }, owned)).toEqual({ id: "row-naruto", type: "anime" });
  });

  it("matches a movie result against the film you own", () => {
    expect(ownedRowFor({ id: 372058, media_type: "movie" }, owned)).toEqual({ id: "row-your-name", type: "film" });
  });

  it("REFUSES a film that merely shares its number with a series you own", () => {
    // THE BUG BATCHING MADE REACHABLE. Without this, the search would mark an unrelated film
    // "In your library" and send you to Game of Thrones.
    expect(ownedRowFor({ id: 1399, media_type: "movie" }, owned)).toBeNull();
  });

  it("REFUSES a show that shares its number with a film you own", () => {
    expect(ownedRowFor({ id: 372058, media_type: "tv" }, owned)).toBeNull();
  });

  it("owns nothing you don't have, and nothing that isn't a title", () => {
    expect(ownedRowFor({ id: 55, media_type: "tv" }, owned)).toBeNull();
    expect(ownedRowFor({ id: 1399, media_type: "person" }, owned)).toBeNull();
    expect(ownedRowFor({ id: 1399, media_type: null }, owned)).toBeNull();
  });
});
