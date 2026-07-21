import { describe, expect, it, vi, afterEach } from "vitest";
import { downscaleImage } from "./downscale-image";

/**
 * These cover the SAFETY branches — the ones where a bug costs you the image you picked, not just
 * some bandwidth. The actual pixel resize needs a real canvas and is verified in a browser; what is
 * asserted here is that every path which cannot resize hands the ORIGINAL file back untouched.
 */
const file = (name: string, type: string, size = 5_000_000) =>
  new File([new Uint8Array(1)], name, { type, lastModified: 0 }) &&
  Object.defineProperty(new File([new Uint8Array(1)], name, { type }), "size", { value: size });

afterEach(() => { vi.unstubAllGlobals(); });

describe("downscaleImage — it may shrink, it may never lose", () => {
  it("passes an SVG through: vector has no pixels to reduce", async () => {
    const f = file("logo.svg", "image/svg+xml");
    expect(await downscaleImage(f)).toBe(f);
  });

  it("passes a GIF through: re-encoding would silently drop the animation", async () => {
    const f = file("loop.gif", "image/gif");
    expect(await downscaleImage(f)).toBe(f);
  });

  it("passes a non-image through untouched", async () => {
    const f = file("notes.pdf", "application/pdf");
    expect(await downscaleImage(f)).toBe(f);
  });

  it("returns the ORIGINAL when decoding fails — a broken decode must not cost you the upload", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode failed")));
    const f = file("photo.jpg", "image/jpeg");
    expect(await downscaleImage(f)).toBe(f);
  });

  it("leaves an already-small image alone rather than re-encoding it", async () => {
    // A 400px image sent through a canvas usually comes back BIGGER. Not resizing is the win.
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 400, height: 600, close: vi.fn() }));
    const f = file("small.jpg", "image/jpeg");
    expect(await downscaleImage(f)).toBe(f);
  });
});
