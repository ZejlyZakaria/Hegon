"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { InlineFormActions } from "@/shared/components/ui/inline-form-actions";
import { useUpcomingEvents, useCreateEvent, useDeleteEvent } from "../hooks/useJournalEvents";

const ACCENT = "var(--color-accent-journal-vivid)";

function eventLabel(dateStr: string): { date: string; rel: string } {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const date = `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
  const rel = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff > 1 ? `in ${diff} days` : "";
  return { date, rel };
}

export function JournalEvents() {
  const { data: events = [] } = useUpcomingEvents(6);
  const create = useCreateEvent();
  const del = useDeleteEvent();

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  const reset = () => {
    setAdding(false);
    setDate("");
    setTitle("");
  };

  const submit = () => {
    if (!title.trim() || !date) return;
    create.mutate({ event_date: date, title: title.trim() }, { onSuccess: reset });
  };

  return (
    <div className="surface-card rounded-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-secondary">Events</h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="Add event"
          className="flex h-6 w-6 items-center justify-center rounded-control text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <Plus size={14} />
        </button>
      </div>

      {adding && (
        <div className="flex flex-col gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-control border border-border-default bg-surface-2 px-2.5 text-xs text-text-primary transition-colors hover:bg-surface-3 focus:border-border-focus focus:outline-none [color-scheme:dark]"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Event title…"
            maxLength={120}
            autoFocus
            className="h-9 rounded-control border border-border-default bg-surface-2 px-2.5 text-xs text-text-primary placeholder:text-text-tertiary transition-colors hover:bg-surface-3 focus:border-border-focus focus:outline-none"
          />
          <InlineFormActions
            onCancel={reset}
            onSave={submit}
            saving={create.isPending}
            disabled={!title.trim() || !date}
            accent={ACCENT}
            saveLabel="Add"
          />
        </div>
      )}

      {events.length === 0 && !adding ? (
        <p className="text-xs text-text-tertiary">No upcoming events.</p>
      ) : (
        events.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {events.map((e) => {
              const { date: dLabel, rel } = eventLabel(e.event_date);
              return (
                <div key={e.id} className="group flex items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-tile"
                    style={{ backgroundColor: `color-mix(in srgb, ${ACCENT} 14%, transparent)`, color: ACCENT }}
                  >
                    <span className="text-[10px] font-bold leading-none">{dLabel.split(" ")[1]}</span>
                    <span className="text-[8px] uppercase leading-none opacity-80">{dLabel.split(" ")[0]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">{e.title}</p>
                    {rel && <p className="text-[10px] text-text-tertiary">{rel}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate(e.id)}
                    aria-label="Remove event"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
