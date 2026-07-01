"use client";

import { Plus, Check } from "lucide-react";
import { FadeIn } from "@/shared/components/ui/motion";
import { useJournalToday } from "../hooks/useJournalToday";
import { useTodayContext } from "../hooks/useJournalCalendar";
import { useEntryDraft } from "../hooks/useEntryDraft";
import { buildContextItems } from "../lib/context";
import { MoodOrbs } from "./MoodOrbs";
import { JournalEditor } from "./JournalEditor";
import { JournalPrompts, JOURNAL_SEEDS } from "./JournalPrompts";
import { JournalContextChips } from "./JournalContextChips";
import { JournalTodayViewSkeleton } from "./JournalSkeleton";
import type { JournalContextItem } from "../types";

// Timezone-safe: use local date, not UTC
function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function JournalTodayView() {
  const { data: entry, isLoading } = useJournalToday();
  const draft = useEntryDraft(entry ?? null, getTodayLocal());

  if (isLoading) return <JournalTodayViewSkeleton />;

  // Prompts/templates stay available while the entry is unsaved AND the draft is
  // still empty or an untouched seed — so you can freely re-pick before writing.
  const showSeeds = !entry && (draft.content.trim() === "" || JOURNAL_SEEDS.has(draft.content));

  return (
    <FadeIn className="flex flex-col gap-5">
      {/* Mood */}
      <MoodOrbs value={draft.mood} onChange={draft.setMood} />

      {/* Prompts + templates — fill the draft (no save), re-pickable */}
      {showSeeds && <JournalPrompts onPick={draft.setContent} />}

      {/* Editor */}
      <div>
        <JournalEditor
          content={draft.content}
          tags={draft.tags}
          onContentChange={draft.setContent}
          onTagsChange={draft.setTags}
          onSave={draft.save}
          dirty={draft.dirty}
          saving={draft.saving}
          goalId={draft.goalId}
          onGoalChange={draft.setGoalId}
          context={draft.context}
          onContextChange={draft.setContext}
          placeholder="What's on your mind?"
        />
      </div>

      {/* Today's context — the cross-module narrative layer (attachable to the entry) */}
      <div className="pb-2">
        <TodayContext attachedItems={draft.context} onAttach={draft.setContext} />
      </div>
    </FadeIn>
  );
}

const ctxKey = (items: JournalContextItem[]) => items.map((i) => `${i.type}|${i.label}`).join("~");

function TodayContext({
  attachedItems,
  onAttach,
}: {
  attachedItems: JournalContextItem[];
  onAttach: (items: JournalContextItem[]) => void;
}) {
  const { data } = useTodayContext();
  const items = data ? buildContextItems(data) : [];

  const attached = attachedItems.length > 0;
  // Attached snapshot is stale if the live context has changed since attaching.
  const stale = attached && ctxKey(attachedItems) !== ctxKey(items);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">Today&apos;s context</p>
        {items.length > 0 &&
          (!attached ? (
            <button
              type="button"
              onClick={() => onAttach(items)}
              title="Add today's context to this entry"
              className="flex items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary"
            >
              <Plus size={12} />
              Add to entry
            </button>
          ) : stale ? (
            <button
              type="button"
              onClick={() => onAttach(items)}
              title="Update the attached context to match now"
              className="flex items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary"
            >
              <Plus size={12} />
              Update
            </button>
          ) : (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium"
              style={{ color: "var(--color-accent-journal-vivid)" }}
            >
              <Check size={12} />
              Added
            </span>
          ))}
      </div>

      {items.length === 0 ? (
        <p className="text-xs italic text-text-tertiary/70">
          Nothing logged across HEGON yet today.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <JournalContextChips items={items} />
        </div>
      )}
    </div>
  );
}
