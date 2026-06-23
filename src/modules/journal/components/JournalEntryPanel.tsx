"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { MoodOrbs } from "./MoodOrbs";
import { JournalEditor } from "./JournalEditor";
import { useDeleteEntry } from "../hooks/useJournalToday";
import { useEntryDraft, clearJournalDraft } from "../hooks/useEntryDraft";
import { formatEntryDate } from "../lib/journal-utils";
import type { JournalEntry } from "../types";

interface Props {
  entry: JournalEntry | null;
  onClose: () => void;
}

// Inner body — mounts/unmounts with the entry so the draft resets per entry.
function PanelBody({ entry }: { entry: JournalEntry }) {
  const draft = useEntryDraft(entry, entry.entry_date);
  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <p className="text-sm font-semibold text-text-primary">
        {formatEntryDate(entry.entry_date)}
      </p>
      <MoodOrbs value={draft.mood} onChange={draft.setMood} />
      <JournalEditor
        bare
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
      />
    </div>
  );
}

// Past-entry detail — opens in the shared sliding panel so the All Entries list
// stays visible behind it. Header mirrors HabitDetailPanel: type label + delete + close.
export function JournalEntryPanel({ entry, onClose }: Props) {
  const del = useDeleteEntry();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (!entry) return;
    const entryDate = entry.entry_date;
    del.mutate(
      { id: entry.id, entryDate },
      { onSuccess: () => { clearJournalDraft(entryDate); setConfirming(false); onClose(); } },
    );
  };

  return (
    <>
      <SlidingPanel
        open={!!entry}
        onClose={onClose}
        title={<span className="text-xs text-text-tertiary">Edit entry</span>}
        headerAction={
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Delete entry"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        }
      >
        {entry && <PanelBody entry={entry} />}
      </SlidingPanel>

      <Dialog open={confirming} onOpenChange={(v) => !v && setConfirming(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Delete entry
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Permanently delete this entry? This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              className="h-9 border-border-default text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={del.isPending}
              className="h-9 text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#ef4444" }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
