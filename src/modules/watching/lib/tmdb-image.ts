import { tmdbPathFromUrl } from "../service";

/**
 * ASK TMDB FOR THE SIZE YOU ARE GOING TO SHOW.
 *
 * ⚠️ THE MEASUREMENT THAT CREATED THIS FILE: one load of /perso/watching/movies fetched **22.4 MB**
 * of images. 20.6 MB of that was 35 backdrops requested at `original` — TMDB's source file, often
 * several thousand pixels wide, averaging 603 KB — to fill a card a few hundred pixels across. The
 * posters were no better in ratio: 500px downloaded for a 160px tile.
 *
 * The cause is that the size is FROZEN AT WRITE TIME. `poster_url` is stored containing `/t/p/w500/`
 * and `backdrop_url` containing `/t/p/original/` (see `mapTmdbDetails` and the add path), so every
 * surface inherits a decision made by whoever first saved the row.
 *
 * ⛔ A MIGRATION CANNOT FIX THIS, and that is the whole design argument: one stored URL is ONE size,
 * but a poster tile wants w185, a hero wants w1280, and a card wants w500. Rewriting the column just
 * moves which readers are wrong. This is a variant-PER-CONSUMER problem, so it can only be resolved
 * where the consumer is — at render.
 *
 * Built on `tmdbPathFromUrl`, which already knows how to take a TMDB URL apart and already returns
 * null for anything that isn't one. That null is load-bearing: `poster_url` may be a Supabase
 * Storage URL for a poster the owner uploaded himself, and those must pass through untouched.
 */

/** TMDB's published widths. Anything else 404s, so the type keeps callers honest. */
export type TmdbSize =
  | "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

/**
 * The variant to request for an image that will be displayed `cssPx` wide.
 *
 * Scaled by device pixel ratio — a 160px tile on a retina display genuinely needs ~320px of image,
 * and serving w185 there is the *other* failure mode we measured (an 804px slot fed a 500px file,
 * which is simply blurry). Then rounded UP to a real TMDB width, never down: too small is a visible
 * defect, too big is only bytes.
 *
 * ⚠️ `dpr` DEFAULTS TO 2, AND MOST CALLERS MUST LEAVE IT THERE. A rail carries dozens of images, so
 * ×2 is the ceiling before the download weight becomes the "stampede" the size ladder exists to
 * prevent. Pass `dpr = 3` ONLY on a LOW-COUNT surface — a hero poster, a fiche's one profile — where
 * a single sharper image costs nothing at the page level but visibly helps on a ×3 phone (a flagship
 * screen the ×2 assumption under-serves: a 160px poster wants ~480px there, and ×2 only asks 320).
 */
export function tmdbSizeFor(cssPx: number, dpr = 2): TmdbSize {
  const needed = cssPx * dpr;
  if (needed <= 92) return "w92";
  if (needed <= 154) return "w154";
  if (needed <= 185) return "w185";
  if (needed <= 342) return "w342";
  if (needed <= 500) return "w500";
  if (needed <= 780) return "w780";
  return "w1280";
}

/**
 * Rewrite a stored TMDB image URL to a different size. Returns the input untouched when it is not a
 * TMDB URL (an uploaded poster, a local asset, a placeholder) or when there is nothing to resize.
 */
export function tmdbImage(url: string | null | undefined, size: TmdbSize): string | null {
  if (!url) return null;
  const path = tmdbPathFromUrl(url);
  if (!path) return url; // not ours to resize — hand it back exactly as it came
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Same, for a display width in CSS pixels. `dpr` defaults to 2 — see tmdbSizeFor before raising it. */
export function tmdbImageFor(url: string | null | undefined, cssPx: number, dpr = 2): string | null {
  return tmdbImage(url, tmdbSizeFor(cssPx, dpr));
}
