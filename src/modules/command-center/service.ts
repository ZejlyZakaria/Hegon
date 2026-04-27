import { createClient } from "@/infrastructure/supabase/client";
import { getCurrentOrgId } from "@/shared/utils/getOrgId";
import type { CommandResult } from "./types";

export async function searchAll(query: string): Promise<CommandResult[]> {
  const supabase = createClient();
  const orgId = await getCurrentOrgId();
  const q = query.replace(/[%,]/g, "\\$&");

  const [goalsRes, habitsRes, journalRes, booksRes, tasksRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, title, category")
      .eq("org_id", orgId)
      .ilike("title", `%${q}%`)
      .limit(3),
    supabase
      .from("habits")
      .select("id, title")
      .eq("org_id", orgId)
      .ilike("title", `%${q}%`)
      .limit(3),
    supabase
      .from("journal_entries")
      .select("id, title, entry_date")
      .eq("org_id", orgId)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order("entry_date", { ascending: false })
      .limit(3),
    supabase
      .from("books")
      .select("id, title, author")
      .eq("org_id", orgId)
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .limit(3),
    supabase
      .from("tasks")
      .select("id, title")
      .eq("org_id", orgId)
      .ilike("title", `%${q}%`)
      .limit(3),
  ]);

  const results: CommandResult[] = [];

  for (const g of goalsRes.data ?? []) {
    results.push({ id: g.id, module: "goals", title: g.title, subtitle: g.category ?? undefined, href: `/life/goals/${g.id}` });
  }
  for (const h of habitsRes.data ?? []) {
    results.push({ id: h.id, module: "habits", title: h.title, href: "/life/habits" });
  }
  for (const j of journalRes.data ?? []) {
    results.push({ id: j.id, module: "journal", title: j.title ?? j.entry_date, subtitle: j.entry_date, href: "/life/journal" });
  }
  for (const b of booksRes.data ?? []) {
    results.push({ id: b.id, module: "books", title: b.title, subtitle: b.author ?? undefined, href: `/life/books/${b.id}` });
  }
  for (const t of tasksRes.data ?? []) {
    results.push({ id: t.id, module: "tasks", title: t.title, href: "/pro/tasks" });
  }

  return results;
}
