import { createClient } from "@/infrastructure/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import { toLocalDateStr, computeStreak } from "./lib/book-utils";
import type {
  Book,
  BookStatus,
  BookStats,
  BooksRightPanelData,
  BookQuote,
  CreateBookInput,
  UpdateBookInput,
  UpdateProgressInput,
  ReadingLogRow,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteWithBook,
} from "./types";

// Record pages read TODAY for a book (atomic add via RPC). Only forward progress
// is logged — page corrections (delta ≤ 0) are ignored. Best-effort: a failed log
// never blocks the page update itself.
async function logReadingDelta(supabase: SupabaseClient, bookId: string, delta: number) {
  if (delta <= 0) return;
  await supabase
    .rpc("log_book_reading", { p_book_id: bookId, p_date: toLocalDateStr(new Date()), p_pages: delta })
    .then(({ error }) => { if (error) console.error("log_book_reading failed", error); });
}

// Upload a custom book cover to the public `posters` bucket → returns its URL.
// Mirrors Watching's custom-poster flow (same bucket, book-covers subfolder).
export async function uploadBookCover(file: File): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${user.id}/book-covers/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("posters").upload(filePath, file);
  if (error) return null;
  const { data } = supabase.storage.from("posters").getPublicUrl(filePath);
  return data.publicUrl;
}

// =====================================================
// READ
// =====================================================

export async function getBooks(opts?: {
  status?: BookStatus;
  favorite?: boolean;
  sort?: "recently_added" | "rating" | "title" | "most_read";
}): Promise<Book[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  let query = supabase.from("books").select("*").eq("org_id", orgId);

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.favorite) query = query.eq("favorite", true);

  switch (opts?.sort) {
    case "rating":
      query = query.order("rating", { ascending: false, nullsFirst: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "most_read":
      query = query.order("current_page", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getBook(id: string): Promise<Book | null> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getBookStats(): Promise<BookStats> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const thisYearStart = `${new Date().getFullYear()}-01-01`;

  const { data, error } = await supabase
    .from("books")
    .select("status, rating, finished_at, favorite")
    .eq("org_id", orgId);

  if (error) throw error;
  type BookStatsRow = Pick<Book, "status" | "rating" | "finished_at" | "favorite">;
  const books = (data ?? []) as BookStatsRow[];

  const reading = books.filter((b: BookStatsRow) => b.status === "reading").length;
  const want_to_read = books.filter((b: BookStatsRow) => b.status === "want_to_read").length;
  const favorites = books.filter((b: BookStatsRow) => b.favorite).length;
  const completed_this_year = books.filter(
    (b: BookStatsRow) => b.status === "read" && b.finished_at && b.finished_at >= thisYearStart
  ).length;

  const rated = books.filter((b: BookStatsRow) => b.status === "read" && b.rating !== null);
  const avg_rating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum: number, b: BookStatsRow) => sum + b.rating!, 0) / rated.length) * 10
        ) / 10
      : null;

  return { total: books.length, reading, completed_this_year, want_to_read, favorites, avg_rating };
}

export async function getRightPanelData(): Promise<BooksRightPanelData> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const today = new Date();
  const yearAgoStr = toLocalDateStr(
    new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  );
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // The reading log is the single source of truth for every time-based metric:
  // distinct days = streak/dots, summed pages = pages this month. Recently-finished
  // still comes from the books table (it's a status fact, not a daily event).
  const [logRes, booksRes] = await Promise.all([
    supabase
      .from("book_reading_log")
      .select("date, pages_read")
      .eq("org_id", orgId)
      .gte("date", yearAgoStr),
    supabase
      .from("books")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "read")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(3),
  ]);

  if (logRes.error) throw logRes.error;
  if (booksRes.error) throw booksRes.error;

  const logRows = (logRes.data ?? []) as { date: string; pages_read: number }[];

  // Streak + weekly dots — distinct days that have any logged reading.
  const dateSet = new Set<string>(logRows.map((r) => r.date));
  const streak = computeStreak(dateSet);
  const activityLast7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return dateSet.has(toLocalDateStr(d));
  });

  // Pages this month — actual pages read this month, across ALL books (in-progress
  // included), regardless of when the book was started.
  const pages_this_month = logRows
    .filter((r) => r.date >= monthStart)
    .reduce((sum, r) => sum + (r.pages_read ?? 0), 0);

  const recently_finished = (booksRes.data ?? []) as Book[];

  return { streak, pages_this_month, recently_finished, activityLast7 };
}

// All reading-log rows for the period — Σ pages_read powers the Stats "pages read"
// (in-progress books included). Pass a year to scope, or null for all-time.
export async function getReadingLog(year: number | null): Promise<ReadingLogRow[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  let query = supabase
    .from("book_reading_log")
    .select("date, pages_read, book_id")
    .eq("org_id", orgId);

  if (year) {
    query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReadingLogRow[];
}

// =====================================================
// SETTINGS (book_user_settings)
// =====================================================

export async function getBookSettings(): Promise<{ monthly_pages_target: number | null }> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("book_user_settings")
    .select("monthly_pages_target")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return { monthly_pages_target: data?.monthly_pages_target ?? null };
}

export async function setMonthlyPagesTarget(target: number | null): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { error } = await supabase
    .from("book_user_settings")
    .upsert({ org_id: orgId, monthly_pages_target: target }, { onConflict: "org_id" });
  if (error) throw error;
}

// =====================================================
// WRITE
// =====================================================

export async function createBook(input: CreateBookInput): Promise<Book> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("books")
    .insert({
      org_id:      orgId,
      user_id:     user.id,
      title:       input.title,
      author:      input.author ?? null,
      cover_url:   input.cover_url ?? null,
      external_id: input.external_id ?? null,
      year:        input.year ?? null,
      genre:       input.genre ?? [],
      total_pages: input.total_pages ?? null,
      description: input.description ?? null,
      status:      input.status ?? "want_to_read",
      goal_id:     input.goal_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBook(input: UpdateBookInput): Promise<Book> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { id, ...updates } = input;

  // When this update advances current_page (e.g. marking a book "read" jumps it to
  // total_pages), log the read pages for today — same source of truth as progress.
  let prevPage: number | undefined;
  if (updates.current_page !== undefined) {
    const { data: prev } = await supabase
      .from("books")
      .select("current_page")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    prevPage = prev?.current_page ?? 0;
  }

  const { data, error } = await supabase
    .from("books")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;

  if (updates.current_page !== undefined && prevPage !== undefined) {
    await logReadingDelta(supabase, id, updates.current_page - prevPage);
  }
  return data;
}

export async function updateProgress(input: UpdateProgressInput): Promise<Book> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  // Read the old page first so we can log how many pages were read today.
  const { data: prev } = await supabase
    .from("books")
    .select("current_page")
    .eq("id", input.id)
    .eq("org_id", orgId)
    .single();

  const { data, error } = await supabase
    .from("books")
    .update({ current_page: input.current_page })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;

  await logReadingDelta(supabase, input.id, input.current_page - (prev?.current_page ?? 0));
  return data;
}

export async function deleteBook(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

// =====================================================
// QUOTES
// =====================================================

export async function getBookQuotes(bookId: string): Promise<BookQuote[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("book_quotes")
    .select("*")
    .eq("book_id", bookId)
    .eq("org_id", orgId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Every quote across all books — for the global Quotes Wall (commonplace book).
export async function getAllQuotes(): Promise<QuoteWithBook[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("book_quotes")
    .select("*, book:books(title, author, cover_url, rating)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((q) => ({
    ...q,
    book_title:  q.book?.title ?? "Unknown",
    book_author: q.book?.author ?? null,
    book_cover:  q.book?.cover_url ?? null,
    book_rating: q.book?.rating ?? null,
  }));
}

export async function createQuote(input: CreateQuoteInput): Promise<BookQuote> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Append to the end of the book's quote list.
  const { count } = await supabase
    .from("book_quotes")
    .select("id", { count: "exact", head: true })
    .eq("book_id", input.book_id)
    .eq("org_id", orgId);

  const { data, error } = await supabase
    .from("book_quotes")
    .insert({
      org_id:   orgId,
      user_id:  user.id,
      book_id:  input.book_id,
      text:     input.text,
      page:     input.page ?? null,
      note:     input.note ?? null,
      position: count ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateQuote(input: UpdateQuoteInput): Promise<BookQuote> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from("book_quotes")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("book_quotes")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}
