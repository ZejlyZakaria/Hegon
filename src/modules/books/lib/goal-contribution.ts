import type { BooksGoalSummary } from "@/modules/goals/service";

// Does a read book count toward this goal? (period match — a book has no sub-type)
export function goalMatchesBook(
  goal: BooksGoalSummary,
  book: { finished_at: string | null },
): boolean {
  if (goal.metric_period === "year" && goal.metric_year) {
    if (!book.finished_at) return false;
    if (new Date(book.finished_at).getFullYear() !== goal.metric_year) return false;
  }
  return true;
}

// Would marking a book read NOW count toward this goal? (finished_at = today)
export function goalBookWouldCount(goal: BooksGoalSummary): boolean {
  if (goal.metric_period === "year" && goal.metric_year) {
    return goal.metric_year === new Date().getFullYear();
  }
  return true;
}
