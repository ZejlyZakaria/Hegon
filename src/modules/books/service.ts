import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import { toLocalDateStr, computeStreak } from "./lib/book-utils";
import type {
  Book,
  BookStatus,
  BookStats,
  BooksRightPanelData,
  CreateBookInput,
  UpdateBookInput,
  UpdateProgressInput,
} from "./types";

// =====================================================
// READ
// =====================================================

export async function getBooks(opts?: {
  status?: BookStatus;
  search?: string;
  favorite?: boolean;
  sort?: "recently_added" | "rating" | "title" | "most_read";
}): Promise<Book[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  let query = supabase.from("books").select("*").eq("org_id", orgId);

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.favorite) query = query.eq("favorite", true);
  if (opts?.search) {
    // Escape PostgREST special chars to prevent filter injection via the or() string
    const safe = opts.search.replace(/[%,]/g, "\\$&");
    query = query.or(`title.ilike.%${safe}%,author.ilike.%${safe}%`);
  }

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
    .select("status, rating, finished_at")
    .eq("org_id", orgId);

  if (error) throw error;
  const books = data ?? [];

  const reading = books.filter((b) => b.status === "reading").length;
  const want_to_read = books.filter((b) => b.status === "want_to_read").length;
  const completed_this_year = books.filter(
    (b) => b.status === "read" && b.finished_at && b.finished_at >= thisYearStart
  ).length;

  const rated = books.filter((b) => b.status === "read" && b.rating !== null);
  const avg_rating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum, b) => sum + b.rating!, 0) / rated.length) * 10
        ) / 10
      : null;

  return { total: books.length, reading, completed_this_year, want_to_read, avg_rating };
}

export async function getRightPanelData(): Promise<BooksRightPanelData> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const today = new Date();
  const yearAgoStr = toLocalDateStr(
    new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  );
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["reading", "read"]);

  if (error) throw error;
  const books: Book[] = data ?? [];

  // Streak — distinct dates where a book was actively read (skip reading with 0 pages)
  const dateSet = new Set<string>();
  for (const b of books) {
    if (b.status === "reading" && b.current_page === 0) continue;
    const dateStr = b.updated_at.split("T")[0];
    if (dateStr >= yearAgoStr) dateSet.add(dateStr);
  }
  const streak = computeStreak(dateSet);

  // activityLast7 — actual per-day activity for the week dots
  const activityLast7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return dateSet.has(toLocalDateStr(d));
  });

  // Pages this month — books finished this month + books started this month (current_page)
  // Reading books started before this month excluded: we can't know how much was read this month
  const pages_this_month =
    books
      .filter((b) => b.status === "read" && b.finished_at && b.finished_at >= monthStart)
      .reduce((sum, b) => sum + (b.total_pages ?? 0), 0) +
    books
      .filter((b) => b.status === "reading" && b.started_at && b.started_at >= monthStart)
      .reduce((sum, b) => sum + (b.current_page ?? 0), 0);

  // Recently finished — last 3 books marked as read
  const recently_finished = books
    .filter((b) => b.status === "read" && b.finished_at)
    .sort((a, b) => (b.finished_at! > a.finished_at! ? 1 : -1))
    .slice(0, 3);

  return { streak, pages_this_month, recently_finished, activityLast7 };
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

  const { data, error } = await supabase
    .from("books")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProgress(input: UpdateProgressInput): Promise<Book> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("books")
    .update({ current_page: input.current_page })
    .eq("id", input.id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
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
