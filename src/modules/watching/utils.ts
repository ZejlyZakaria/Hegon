// Use original_title if Latin script (incl. French/Spanish accents up to U+024F).
// Fall back to title for CJK, Korean, Arabic, etc.
export function displayTitle(item: { title: string; original_title: string | null }): string {
  if (!item.original_title) return item.title;
  return /[ɐ-￿]/.test(item.original_title) ? item.title : item.original_title;
}
