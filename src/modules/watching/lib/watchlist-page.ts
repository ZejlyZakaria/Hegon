/** Intersect a global page with ordered priority buckets without loading the whole list. */
export function priorityPageRanges(counts: number[], offset: number, size = 50) {
  let preceding = 0;
  return counts.map((count) => {
    const from = Math.max(0, offset - preceding);
    const to = Math.min(count - 1, offset + size - 1 - preceding);
    preceding += count;
    return to < from ? null : { from, to };
  });
}
/** Quote PostgREST values and preserve released/search predicates together. */
export function watchlistFilter(search: string, released: string | null): string | null {
  const needle = search.trim();
  if (!needle) return released;
  const pattern = JSON.stringify(`%${needle.replace(/[\\%_]/g, (character) => "\\" + character)}%`);
  const match = `title.ilike.${pattern},original_title.ilike.${pattern}`;
  return released ? `and(or(${released}),or(${match}))` : match;
}
