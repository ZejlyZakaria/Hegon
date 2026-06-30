import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  JournalEntry,
  JournalCalendarDay,
  JournalStreak,
  JournalEvent,
  CreateJournalEntryInput,
  CreateJournalEventInput,
  UpdateJournalEntryInput,
} from "./types";

// Local-time date string — avoids UTC shift for users in non-UTC timezones
function toLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// =====================================================
// READ
// =====================================================

export async function getTodayEntry(): Promise<JournalEntry | null> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const today = toLocalDate();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .eq("entry_date", today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getEntry(date: string): Promise<JournalEntry | null> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .eq("entry_date", date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getEntries(opts?: {
  search?: string;
  mood?: string;
  limit?: number;
  offset?: number;
}): Promise<JournalEntry[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  let query = supabase
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false });

  if (opts?.mood) {
    query = query.eq("mood", opts.mood);
  }

  if (opts?.search) {
    const safe = opts.search.replace(/[%,]/g, "\\$&");
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`);
  }

  if (opts?.limit) {
    const offset = opts.offset ?? 0;
    query = query.range(offset, offset + opts.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Returns entry_date + mood only — used for calendar heatmap
export async function getCalendarData(
  year: number,
  month: number
): Promise<JournalCalendarDay[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date, mood")
    .eq("org_id", orgId)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// b is the calendar day immediately after a (both 'YYYY-MM-DD', boundary-safe).
function isNextDay(a: string, b: string): boolean {
  const d = new Date(a + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return toLocalDate(d) === b;
}

// Streak over the FULL history (no 365-day cap). Only entry_date is fetched, so
// it stays light even for years of entries.
export async function getStreak(): Promise<JournalStreak> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date")
    .eq("org_id", orgId)
    .order("entry_date", { ascending: true });

  if (error) throw error;

  const dates = (data ?? []).map((r: { entry_date: string }) => r.entry_date);
  const dateSet = new Set(dates);

  // Best — single O(n) pass over the sorted dates counting consecutive days.
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && isNextDay(prev, d) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  // Current — walk back from today (or yesterday) while entries exist.
  const todayStr = toLocalDate();
  const yesterdayStr = toLocalDate(new Date(Date.now() - 86_400_000));
  const cursor: Date | null = dateSet.has(todayStr)
    ? new Date()
    : dateSet.has(yesterdayStr)
      ? new Date(Date.now() - 86_400_000)
      : null;
  let current = 0;
  while (cursor && dateSet.has(toLocalDate(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, best };
}

// Cross-module "what you actually did today" — the narrative layer over the
// other modules. RLS scopes every table to the current org/user.
export interface JournalTodayContext {
  habitsCompleted: number;
  watched: { title: string; type: string }[];
  books: { title: string; pages: number }[];
}

export async function getTodayContext(): Promise<JournalTodayContext> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const today = toLocalDate();
  const tomorrow = toLocalDate(new Date(Date.now() + 86_400_000));

  const [habitsRes, watchedRes, booksRes] = await Promise.all([
    supabase
      .from("habit_completions")
      .select("id", { count: "exact", head: true })
      .eq("completed_date", today),
    supabase
      .schema("watching")
      .from("media_items")
      .select("title, type")
      .gte("watched_at", `${today}T00:00:00`)
      .lt("watched_at", `${tomorrow}T00:00:00`),
    supabase
      .from("book_reading_log")
      .select("pages_read, books(title)")
      .eq("org_id", orgId)
      .eq("date", today),
  ]);

  const watched = ((watchedRes.data ?? []) as { title: string; type: string }[]).map((m) => ({
    title: m.title,
    type: m.type,
  }));
  const books = ((booksRes.data ?? []) as { pages_read: number; books: { title: string } | null }[])
    .map((r) => ({ title: r.books?.title ?? "a book", pages: r.pages_read ?? 0 }))
    .filter((b) => b.pages > 0);

  return {
    habitsCompleted: habitsRes.count ?? 0,
    watched,
    books,
  };
}

// "On this day" — entries from the same month/day in previous years. `entry_date`
// is a DATE column, so LIKE/~~ isn't valid on it — match the month-day client-side.
export async function getOnThisDay(): Promise<JournalEntry[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const now = new Date();
  const md = `-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayStr = toLocalDate();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("org_id", orgId)
    .neq("entry_date", todayStr)
    .order("entry_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).filter((e: JournalEntry) => e.entry_date.endsWith(md));
}

// =====================================================
// EVENTS — important dates / reminders
// =====================================================

export async function getEventsForMonth(year: number, month: number): Promise<JournalEvent[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  const { data, error } = await supabase
    .from("journal_events")
    .select("*")
    .eq("org_id", orgId)
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Upcoming events from today onward — for the Events card + the Dashboard.
export async function getUpcomingEvents(limit = 5): Promise<JournalEvent[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("journal_events")
    .select("*")
    .eq("org_id", orgId)
    .gte("event_date", toLocalDate())
    .order("event_date", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createEvent(input: CreateJournalEventInput): Promise<JournalEvent> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { data, error } = await supabase
    .from("journal_events")
    .insert({
      org_id:     orgId,
      event_date: input.event_date,
      title:      input.title,
      note:       input.note ?? null,
      type:       input.type ?? "reminder",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("journal_events")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}

// =====================================================
// WRITE
// =====================================================

export async function createEntry(
  input: CreateJournalEntryInput
): Promise<JournalEntry> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const row: Record<string, unknown> = {
    org_id:     orgId,
    user_id:    user.id,
    entry_date: input.entry_date,
    title:      input.title ?? null,
    content:    input.content ?? "",
    mood:       input.mood ?? null,
    tags:       input.tags ?? [],
  };
  // Only send goal_id / context when actually set — a fresh DB without those
  // columns still creates plain entries fine.
  if (input.goal_id) row.goal_id = input.goal_id;
  if (input.context && input.context.length) row.context = input.context;

  const { data, error } = await supabase
    .from("journal_entries")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEntry(
  input: UpdateJournalEntryInput
): Promise<JournalEntry> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const { id, ...updates } = input;

  // word_count is a GENERATED column — the DB recomputes it from content.
  const patch: Record<string, unknown> = { ...updates };

  const { data, error } = await supabase
    .from("journal_entries")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) throw error;
}
