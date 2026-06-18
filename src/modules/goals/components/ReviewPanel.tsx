"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/utils";
import { useReviewDraft, useCreateReview } from "../hooks/useReviews";
import type { ReviewMovement } from "../types";

const ACCENT = "var(--color-accent-goals)";

function fmtRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-GB", opts);
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-GB", opts);
  return `${s} – ${e}`;
}

// One row of the "what moved" mirror — current % + the delta vs last review.
function MovementRow({ m }: { m: ReviewMovement }) {
  const up = (m.delta ?? 0) > 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{m.title}</span>
      {m.isNew ? (
        <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">New</span>
      ) : up ? (
        <span className="shrink-0 text-[11px] font-semibold text-green-400">▲ +{m.delta}%</span>
      ) : (
        <span className="shrink-0 text-[11px] text-text-tertiary">—</span>
      )}
      <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-text-tertiary">{m.progress}%</span>
    </div>
  );
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function ReviewPanel({ open, onClose }: Props) {
  const { data: draft, isLoading } = useReviewDraft(open);
  const createReview = useCreateReview();

  const [wins,     setWins]     = useState("");
  const [blockers, setBlockers] = useState("");
  const [focus,    setFocus]    = useState("");
  const [toJournal, setToJournal] = useState(true);

  // Reset the form on close (covers Cancel, save, Esc and overlay) — next open is fresh.
  const handleClose = () => {
    setWins("");
    setBlockers("");
    setFocus("");
    setToJournal(true);
    onClose();
  };

  const moved = (draft?.movements ?? []).filter((m) => (m.delta ?? 0) > 0).length;

  async function handleSave() {
    await createReview.mutateAsync({ wins, blockers, focus, saveToJournal: toJournal });
    handleClose();
  }

  return (
    <SlidingPanel
      open={open}
      onClose={handleClose}
      width="wide"
      title={
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">Weekly Review</span>
          {draft && (
            <span className="truncate text-xs font-normal text-text-tertiary">
              {fmtRange(draft.period_start, draft.period_end)}
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-3"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={createReview.isPending}
            className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {createReview.isPending ? "Saving…" : "Save review"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {/* ── What moved — the mirror ── */}
        <div className="rounded-control border border-border-subtle bg-surface-2 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <h3 className="text-[11px] font-semibold text-text-secondary">
              What moved
            </h3>
            {moved > 0 && (
              <span className="text-[11px] font-semibold text-green-400">· {moved} advanced</span>
            )}
          </div>
          {isLoading ? (
            <p className="py-2 text-xs text-text-tertiary">Computing your week…</p>
          ) : draft && draft.movements.length > 0 ? (
            <div className="divide-y divide-border-subtle/50">
              {draft.movements.slice(0, 8).map((m) => (
                <MovementRow key={m.goal_id} m={m} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-text-tertiary">No active goals to review yet.</p>
          )}
        </div>

        {/* ── Reflect ── */}
        <Field label="Wins" hint="What went well this week?" value={wins} onChange={setWins} accent />
        <Field label="Blockers" hint="What got in the way?" value={blockers} onChange={setBlockers} />
        <Field label="Focus next week" hint="What's the one thing to push?" value={focus} onChange={setFocus} />

        {/* ── Journal bridge toggle ── */}
        <button
          type="button"
          onClick={() => setToJournal((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-control border border-border-subtle bg-surface-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
              toJournal ? "border-transparent" : "border-border-default",
            )}
            style={toJournal ? { backgroundColor: ACCENT } : undefined}
          >
            {toJournal && <Check size={11} className="text-white" strokeWidth={3} />}
          </span>
          <span className="flex-1">
            <span className="block text-xs font-medium text-text-secondary">Save a copy to Journal</span>
            <span className="block text-[11px] text-text-tertiary">Adds a tagged entry to today&apos;s journal</span>
          </span>
        </button>
      </div>
    </SlidingPanel>
  );
}

function Field({
  label, hint, value, onChange, accent,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void; accent?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />}
        {label}
      </label>
      <Textarea
        variant="tasks"
        placeholder={hint}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 focus:border-border-focus"
      />
    </div>
  );
}
