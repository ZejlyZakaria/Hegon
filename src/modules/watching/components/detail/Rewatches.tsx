"use client";

import { useState } from "react";
import { Repeat, Plus, X, CalendarPlus } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useRewatches, useAddRewatch, useRemoveRewatch } from "../../hooks/useRewatches";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const todayISO = () => new Date().toISOString().slice(0, 10);

// Rewatches (watched items only) — light & chic: the count sits quietly in the
// header, dates are pills (remove on hover), "Log rewatch" 1-taps today, and the
// date picker only appears when you want to backdate.
export function Rewatches({ mediaItemId }: { mediaItemId: string }) {
  const { data: rewatches = [] } = useRewatches(mediaItemId);
  const addRewatch = useAddRewatch(mediaItemId);
  const removeRewatch = useRemoveRewatch(mediaItemId);
  const [date, setDate] = useState(todayISO());
  const [picking, setPicking] = useState(false);

  const count = rewatches.length;

  const log = async (on: string) => {
    if (!on) return;
    try {
      await addRewatch.mutateAsync(on);
      setDate(todayISO());
      setPicking(false);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to log rewatch.");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeRewatch.mutateAsync(id);
    } catch (err) {
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to remove.");
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-title text-text-primary">Rewatches</h2>
        <span className="text-xs text-text-tertiary">
          {count === 0 ? "Not yet" : count === 1 ? "Once" : `${count} times`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rewatches.map((r) => (
          <span
            key={r.id}
            className="group inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-2.5 pr-1.5 text-xs text-text-secondary"
          >
            <Repeat size={11} className="text-accent-watching-vivid" />
            {fmtDate(r.watched_on)}
            <button
              type="button"
              onClick={() => handleRemove(r.id)}
              title="Remove"
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-[opacity,color] hover:text-red-400 group-hover:opacity-100"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => log(todayISO())}
          disabled={addRewatch.isPending}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-default px-3 py-1 text-xs text-text-tertiary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
        >
          <Plus size={12} />
          Log rewatch
        </button>

        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          title="Log a past date"
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${picking ? "text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
        >
          <CalendarPlus size={14} />
        </button>
      </div>

      {picking && (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-2 text-xs text-text-secondary scheme-dark focus:border-border-default focus:outline-none"
          />
          <button
            type="button"
            onClick={() => log(date)}
            disabled={addRewatch.isPending || !date}
            className="rounded-lg bg-accent-watching px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </section>
  );
}
