"use client";

import { Archive, ArchiveRestore, Film, Trash2 } from "lucide-react";
import { resolveIcon } from "@/shared/constants/icons";
import { formatFrequency } from "../utils";
import {
  useHabits,
  useArchivedHabits,
  useArchiveHabit,
  useUnarchiveHabit,
} from "../hooks/useHabits";
import { useHabitsUIStore } from "../store";
import type { Habit } from "../types";

interface Props {
  onDelete: (habit: Habit) => void; // opens the archive / delete-permanently modal
}

export function HabitsAllView({ onDelete }: Props) {
  const { data: habits = [], isLoading } = useHabits();
  const { data: archived = [] } = useArchivedHabits();
  const archive = useArchiveHabit();
  const unarchive = useUnarchiveHabit();
  const openPanel = useHabitsUIStore((s) => s.openPanel);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-subtle border-t-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active */}
      <section>
        <SectionLabel label="All Habits" count={habits.length} />
        {habits.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">No habits yet.</p>
        ) : (
          <div className="space-y-2">
            {habits.map((h) => (
              <ManageRow
                key={h.id}
                habit={h}
                onOpen={() => openPanel(h.id)}
                onArchive={() => archive.mutate(h.id)}
                onDelete={() => onDelete(h)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <SectionLabel label="Archived" count={archived.length} />
          <div className="space-y-2">
            {archived.map((h) => (
              <ManageRow
                key={h.id}
                habit={h}
                archived
                onOpen={() => openPanel(h.id)}
                onRestore={() => unarchive.mutate(h.id)}
                onDelete={() => onDelete(h)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <p className="text-caption uppercase text-text-tertiary">{label}</p>
      <span className="text-[10px] text-text-tertiary">{count}</span>
    </div>
  );
}

function ManageRow({
  habit,
  archived,
  onOpen,
  onArchive,
  onRestore,
  onDelete,
}: {
  habit: Habit;
  archived?: boolean;
  onOpen: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}) {
  const { icon: Icon, color } = resolveIcon(habit.icon);

  return (
    <div
      className={`group flex h-14 items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3 transition-colors hover:bg-surface-2 ${archived ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2"
          style={{ color }}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">{habit.title}</p>
            {habit.source_module === "watching" && (
              <span className="hidden shrink-0 items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-tertiary sm:inline-flex">
                <Film size={10} />
                Auto
              </span>
            )}
          </div>
          <p className="truncate text-xs text-text-tertiary">{formatFrequency(habit)}</p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {archived ? (
          <button
            type="button"
            onClick={onRestore}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <ArchiveRestore size={14} />
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            aria-label="Archive habit"
            title="Archive"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Archive size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete habit"
          title="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
