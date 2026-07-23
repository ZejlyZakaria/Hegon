/**
 * THE DON'T MISS ROW'S TWO DIMENSIONS, as CSS variables so the real row and its skeleton cannot
 * disagree.
 *
 * ⚠️ THIS LIVES IN ITS OWN MODULE FOR A REASON. It used to be exported from
 * `DontMissSectionClient`, which imports `DontMissSkeleton` from `WatchingSkeletons`, which imported
 * this constant back — a CIRCULAR import. Dev tolerated it; the production bundle evaluates modules
 * in a different order, so the skeleton read `ROW_VARS` as `undefined` and rendered
 * `className="flex gap-4 undefined"`. No `h-60`, no `--dm-poster`: the cards had neither width nor
 * height, so the Don't Miss skeleton showed its title and then nothing, and the section only
 * appeared once real data arrived. A constant shared by two modules belongs to neither.
 *
 * `--dm-poster` — NOT a free number: the poster is `inset-y-0` at 2:3, so its width IS the row's
 * height × 2/3. You cannot widen a poster without making the row taller.
 * `--dm-panel` — the open card's text column. FIXED, and that is the point: pinned `right-0` it
 * inherited the card's ANIMATING width and every line inside re-laid-out on every frame.
 *
 * From those two the row sizes itself: every card's flex-basis is one poster, and only the OPEN one
 * grows — so a closed card is EXACTLY its artwork, with no dead strip beside it and nothing cropped
 * off it. The 1700px breakpoint is arithmetic, not taste: 6×192 + 320 + 80 = 1552, and 1552 is what
 * the page's `max-w-400` caps the row at.
 */
export const ROW_VARS =
  "h-60 [--dm-panel:320px] [--dm-poster:160px] min-[1700px]:h-72 min-[1700px]:[--dm-poster:192px]";
