import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type {
  JournalEntry,
  JournalCalendarDay,
  JournalStreak,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from "./types";

// =====================================================
// READ
// =====================================================

export async function getTodayEntry(): Promise<JournalEntry | null> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const today = new Date().toISOString().split("T")[0];

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
    query = query.or(
      `title.ilike.%${opts.search}%,content.ilike.%${opts.search}%`
    );
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

  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);

  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date")
    .eq("org_id", orgId)
    .gte("entry_date", from.toISOString().split("T")[0])
    .order("entry_date", { ascending: false });

  if (error) throw error;

  const dates = new Set((data ?? []).map((r) => r.entry_date));

  const today = new Date();
  let current = 0;
  let best = 0;
  let consecutive = 0;

  // Walk backwards day by day for up to 365 days
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];

    if (dates.has(key)) {
      consecutive++;
      if (i === 0 || current > 0) current = consecutive;
      best = Math.max(best, consecutive);
    } else {
      if (i === 0) {
        // No entry today — streak is still valid from yesterday
        consecutive = 0;
      } else {
        if (current === 0) current = 0;
        consecutive = 0;
      }
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
