import { describe, expect, it } from "vitest";
import { tmdbImage, tmdbImageFor, tmdbSizeFor } from "./tmdb-image";

const BACKDROP = "https://image.tmdb.org/t/p/original/abc123.jpg";
const POSTER = "https://image.tmdb.org/t/p/w500/xyz789.jpg";

describe("tmdbImage — the size is chosen where the image is SHOWN", () => {
  it("rewrites the variant of a stored URL, keeping the path", () => {
    expect(tmdbImage(BACKDROP, "w780")).toBe("https://image.tmdb.org/t/p/w780/abc123.jpg");
    expect(tmdbImage(POSTER, "w185")).toBe("https://image.tmdb.org/t/p/w185/xyz789.jpg");
  });

  it("hands back a NON-TMDB url untouched — this is the load-bearing case", () => {
    // The owner can upload his own poster; it lives in Supabase Storage and must survive intact.
    const uploaded = "https://xyz.supabase.co/storage/v1/object/public/posters/mine.jpg";
    expect(tmdbImage(uploaded, "w185")).toBe(uploaded);
    expect(tmdbImage("/placeholder.svg", "w185")).toBe("/placeholder.svg");
  });

  it("passes null through instead of inventing a url", () => {
    expect(tmdbImage(null, "w185")).toBeNull();
    expect(tmdbImage(undefined, "w185")).toBeNull();
  });
});

describe("tmdbSizeFor — rounds UP, because too small is visible and too big is only bytes", () => {
  it("doubles for high-DPI screens", () => {
    // A 160px tile really needs ~320px of image on a retina display. Serving w185 there is the
    // other failure we measured: an 804px slot fed a 500px file, i.e. blurry.
    expect(tmdbSizeFor(160)).toBe("w342");
    expect(tmdbSizeFor(90)).toBe("w185");
  });

  it("never returns a width below what is asked for", () => {
    for (const px of [50, 77, 96, 171, 250, 300, 390, 640]) {
      const w = Number(tmdbSizeFor(px).replace("w", ""));
      expect(w).toBeGreaterThanOrEqual(px);
    }
  });

  it("caps at w1280 — `original` is never a display size", () => {
    expect(tmdbSizeFor(1200)).toBe("w1280");
    expect(tmdbImageFor(BACKDROP, 1200)).toBe("https://image.tmdb.org/t/p/w1280/abc123.jpg");
  });
});
