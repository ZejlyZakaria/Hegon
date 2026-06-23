import type { JournalTodayContext } from "../service";
import type { JournalContextType, JournalContextItem } from "../types";

// Source-module accent per context type (icon stays semantic — see components).
export const CONTEXT_COLOR: Record<JournalContextType, string> = {
  habits: "var(--color-accent-habits-vivid)",
  watching: "var(--color-accent-watching-vivid)",
  books: "var(--color-accent-books-vivid)",
};

// Turn the live cross-module context into glanceable, name-bearing items.
// Names = the memory ("Read Dune") rather than sterile stats ("4 pages").
export function buildContextItems(ctx: JournalTodayContext): JournalContextItem[] {
  const items: JournalContextItem[] = [];

  if (ctx.habitsCompleted > 0) {
    items.push({ type: "habits", label: `${ctx.habitsCompleted} habit${ctx.habitsCompleted === 1 ? "" : "s"} done` });
  }

  if (ctx.watched.length > 0 && ctx.watched.length <= 2) {
    ctx.watched.forEach((w) => items.push({ type: "watching", label: `Watched ${w.title}` }));
  } else if (ctx.watched.length > 2) {
    items.push({ type: "watching", label: `Watched ${ctx.watched.length} titles` });
  }

  if (ctx.books.length > 0 && ctx.books.length <= 2) {
    ctx.books.forEach((b) =>
      items.push({ type: "books", label: `${b.pages} page${b.pages === 1 ? "" : "s"} — ${b.title}` }),
    );
  } else if (ctx.books.length > 2) {
    const total = ctx.books.reduce((s, b) => s + b.pages, 0);
    items.push({ type: "books", label: `${total} pages · ${ctx.books.length} books` });
  }

  return items;
}
