/**
 * SHRINK IT BEFORE IT LEAVES THE DEVICE.
 *
 * Every upload path in the app — a custom poster, a book cover, a dashboard photo, an avatar — sent
 * the file exactly as the file picker handed it over. On a phone that is a 12-megapixel JPEG, 3-6 MB,
 * to be displayed in a 200px tile. It is then stored at that size forever and re-downloaded on every
 * render, by every surface, for the life of the row.
 *
 * ⚠️ AND NO URL HELPER CAN SAVE IT. `tmdbImage()` resizes by rewriting a TMDB url; a Supabase Storage
 * url has no size to rewrite. Fable flagged this as the blind spot in the image pass: a poster you
 * uploaded yourself would have stayed full-resolution while every TMDB poster got 10× smaller — one
 * title in the grid mysteriously heavier than all its neighbours, months later, with no clue why.
 *
 * So the only place to fix it is before the bytes are sent.
 *
 * Deliberately conservative:
 *   · never UPSCALES — a small image is passed through untouched rather than blown up
 *   · never touches SVG (vector, meaningless to raster) or GIF (would drop the animation)
 *   · returns the ORIGINAL file on any failure — a decode error must cost you a big upload, never
 *     a lost one. Losing the user's chosen image to save bandwidth would be a terrible trade.
 */

/** Longest edge, in pixels, after downscaling. 1024 covers the largest slot any surface renders. */
const MAX_EDGE = 1024;
const QUALITY = 0.85;

const UNTOUCHABLE = /^image\/(svg\+xml|gif)$/;

export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || UNTOUCHABLE.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);

    // Already small enough — sending it through a canvas would only re-encode it, usually larger.
    if (longest <= maxEdge) {
      bitmap.close();
      return file;
    }

    const scale = maxEdge / longest;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // WebP where the browser has it (every browser we support), JPEG as the floor. Never PNG: a
    // photograph as PNG is larger than the original we are trying to shrink.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // no win → keep the original, unchanged

    const name = file.name.replace(/\.\w+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
