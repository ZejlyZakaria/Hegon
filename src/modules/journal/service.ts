import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  JournalEntry,
  JournalCalendarDay,
  JournalStreak,
  CreateJournalEntryInput,
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

// Computes streak from the last 365 days of entry dates
export async function getStreak(): Promise<JournalStreak> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();

  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 1);

  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date")
    .eq("org_id", orgId)
    .gte("entry_date", toLocalDate(fromDate))
    .order("entry_date", { ascending: false });

  if (error) throw error;

  const dates = new Set((data ?? []).map((r) => r.entry_date));

  const todayStr = toLocalDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDate(yesterday);

  // Current streak: walk backward from today if has entry, else from yesterday
  const startOffset = dates.has(todayStr) ? 0 : dates.has(yesterdayStr) ? 1 : -1;
  let current = 0;
  if (startOffset >= 0) {
    for (let i = startOffset; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (dates.has(toLocalDate(d))) current++;
      else break;
    }
  }

  // Best streak: full scan over 365 days
  let best = 0;
  let consecutive = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (dates.has(toLocalDate(d))) {
      consecutive++;
      best = Math.max(best, consecutive);
    } else {
      consecutive = 0;
    }
  }

  return { current, best };
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

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      org_id:     orgId,
      user_id:    user.id,
      entry_date: input.entry_date,
      title:      input.title ?? null,
      content:    input.content ?? "",
      mood:       input.mood ?? null,
      tags:       input.tags ?? [],
    })
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

  const { data, error } = await supabase
    .from("journal_entries")
    .update(updates)
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
