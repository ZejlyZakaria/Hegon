import { useState, useEffect, useRef } from "react";
import { useCreateEntry, useUpdateEntry } from "./useJournalToday";
import type { JournalEntry, JournalMood, JournalContextItem } from "../types";

// Draft model for a journal entry — nothing is persisted to the DB until save().
// Lets the user re-pick prompts/templates/mood/goal freely (no eager creation),
// with an explicit Save button. The in-progress draft is mirrored to localStorage
// so work is never lost if you leave without saving — restored on return, removed
// once it's saved.
type DraftSnapshot = {
  content: string;
  tags: string[];
  mood: JournalMood | null;
  goalId: string | null;
  context: JournalContextItem[];
};

function draftKey(entryDate: string) {
  return `hegon-journal-draft:${entryDate}`;
}

// Canonical key for context comparison — jsonb round-trips reorder object keys,
// so a raw JSON.stringify(draft) !== JSON.stringify(entry.context) would flag
// "dirty" forever after a save. Compare structurally instead.
function ctxKey(items: JournalContextItem[] | null | undefined): string {
  return (items ?? []).map((i) => `${i.type}|${i.label}`).join("~");
}

function readDraft(entryDate: string): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(draftKey(entryDate));
    return raw ? (JSON.parse(raw) as DraftSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearJournalDraft(entryDate: string) {
  try { localStorage.removeItem(draftKey(entryDate)); } catch {}
}
const clearDraft = clearJournalDraft;

export function useEntryDraft(entry: JournalEntry | null, entryDate: string) {
  const create = useCreateEntry();
  const update = useUpdateEntry();

  const [mood, setMood] = useState<JournalMood | null>(entry?.mood ?? null);
  const [content, setContent] = useState(entry?.content ?? "");
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [goalId, setGoalId] = useState<string | null>(entry?.goal_id ?? null);
  const [context, setContext] = useState<JournalContextItem[]>(entry?.context ?? []);

  // Skips the mirror pass that immediately follows a restore, so re-seeding the
  // draft from localStorage can't be mistaken for the user clearing it (which
  // would wipe the just-restored draft).
  const skipMirror = useRef(false);

  // On mount / entry change: restore an autosaved draft if one exists, else seed
  // from the saved entry. (localStorage read in an effect — SSR/hydration safe.)
  useEffect(() => {
    const saved = readDraft(entryDate);
    setMood(saved?.mood ?? entry?.mood ?? null);
    setContent(saved?.content ?? entry?.content ?? "");
    setTags(saved?.tags ?? entry?.tags ?? []);
    setGoalId(saved?.goalId ?? entry?.goal_id ?? null);
    setContext(saved?.context ?? entry?.context ?? []);
    skipMirror.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  const dirty =
    content !== (entry?.content ?? "") ||
    mood !== (entry?.mood ?? null) ||
    goalId !== (entry?.goal_id ?? null) ||
    JSON.stringify(tags) !== JSON.stringify(entry?.tags ?? []) ||
    ctxKey(context) !== ctxKey(entry?.context);

  // Mirror the draft to localStorage (debounced) so work survives leaving the
  // page. When the draft no longer differs from the saved entry (e.g. the user
  // cleared everything back to empty), drop the stale autosave so it can't be
  // restored on return. The pass right after a restore is skipped so re-seeding
  // isn't mistaken for a clear.
  useEffect(() => {
    if (skipMirror.current) {
      skipMirror.current = false;
      return;
    }
    if (!dirty) {
      clearDraft(entryDate);
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(entryDate), JSON.stringify({ content, tags, mood, goalId, context }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [content, tags, mood, goalId, context, dirty, entryDate]);

  const saving = create.isPending || update.isPending;

  const save = () => {
    if (!dirty) return;
    const done = { onSuccess: () => clearDraft(entryDate) };
    if (entry) {
      // Only send goal_id / context when they actually changed → plain
      // content/mood/tags saves still work on a DB without those columns.
      const goalChanged = goalId !== (entry.goal_id ?? null);
      const contextChanged = ctxKey(context) !== ctxKey(entry.context);
      update.mutate(
        {
          id: entry.id, content, tags, mood,
          ...(goalChanged ? { goal_id: goalId } : {}),
          ...(contextChanged ? { context } : {}),
        },
        done,
      );
    } else if (content.trim() || mood) {
      create.mutate({ entry_date: entryDate, content, tags, mood, goal_id: goalId, context }, done);
    }
  };

  return {
    mood, setMood,
    content, setContent,
    tags, setTags,
    goalId, setGoalId,
    context, setContext,
    dirty, saving, save,
    clearLocalDraft: () => clearDraft(entryDate),
  };
}
