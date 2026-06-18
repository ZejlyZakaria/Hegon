"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, Trophy, AlertTriangle, Target, BookOpen } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import { FadeIn, StaggerList, StaggerItem } from "@/shared/components/ui/motion";
import { useReviews, useLastReview } from "../hooks/useReviews";
import { ReviewPanel } from "./ReviewPanel";
import type { GoalReview } from "../types";

const ACCENT = "var(--color-accent-goals)";
const MS_DAY = 86_400_000;
const CADENCE = 7; // weekly

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DAY);
}

function fmtRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const s = new Date(start + "T00:00:00").toLocaleDateString("en-GB", opts);
  const e = new Date(end + "T00:00:00").toLocaleDateString("en-GB", opts);
  return `${s} – ${e}`;
}

// ── Nudge: the cadence prompt that keeps the ritual alive ──
function ReviewNudge({ last, onStart }: { last: GoalReview | null; onStart: () => void }) {
  const since = last ? daysSince(last.created_at) : Infinity;
  const due   = since >= CADENCE;
  const left  = CADENCE - since;

  return (
    <FadeIn y={-6} className="surface-card relative overflow-hidden rounded-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">
            {due ? "Time for your weekly review" : "You're on top of it"}
          </h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {!last
              ? "Take 3 minutes to reflect on your goals and set next week's focus."
              : due
                ? `It's been ${since} days since your last review. Check what moved and reset your focus.`
                : `Next review in ${left} day${left === 1 ? "" : "s"}. You can still run one anytime.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className={cn(
            "h-9 shrink-0 rounded-control px-3 text-sm font-semibold transition-opacity hover:opacity-90",
            due ? "" : "border border-border-default text-text-secondary hover:text-text-primary",
          )}
          style={due ? { backgroundColor: "#fff", color: ACCENT } : undefined}
        >
          {due || !last ? "Start review" : "Review now"}
        </button>
      </div>
    </FadeIn>
  );
}

// ── One past review — collapsed to its focus, expandable to the full reflection ──
function ReviewCard({ review }: { review: GoalReview }) {
  const [open, setOpen] = useState(false);
  const moved = review.snapshot.length;

  return (
    <div className="surface-card overflow-hidden rounded-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              {new Date(review.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {review.journal_entry_id && (
              <BookOpen size={11} className="text-text-tertiary" />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-tertiary">
            {fmtRange(review.period_start, review.period_end)} · {moved} goal{moved === 1 ? "" : "s"}
            {review.focus ? ` · Focus: ${review.focus}` : ""}
          </p>
        </div>
        <ChevronDown
          size={15}
          className={cn("shrink-0 text-text-tertiary transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border-subtle px-4 py-3">
          <ReflectionBlock icon={Trophy}        color="#4ade80" label="Wins"     text={review.wins} />
          <ReflectionBlock icon={AlertTriangle} color="#fb923c" label="Blockers" text={review.blockers} />
          <ReflectionBlock icon={Target}        color="#60a5fa" label="Focus"    text={review.focus} />
        </div>
      )}
    </div>
  );
}

function ReflectionBlock({
  icon: Icon, color, label, text,
}: {
  icon: typeof Trophy; color: string; label: string; text: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon size={12} style={{ color }} />
        <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
        {text.trim() || <span className="text-text-tertiary">—</span>}
      </p>
    </div>
  );
}

export function ReviewsView() {
  const { data: last = null }   = useLastReview();
  const { data: reviews = [], isLoading } = useReviews();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <ReviewNudge last={last} onStart={() => setModalOpen(true)} />

      <div>
        <h3 className="mb-3 text-xs font-semibold text-text-secondary">Past reviews</h3>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-tertiary">
              <Sparkles size={18} />
            </div>
            <p className="text-sm text-text-secondary">No reviews yet</p>
            <p className="max-w-xs text-xs text-text-tertiary">
              Your first weekly review starts the streak — reflect on what moved and set next week&apos;s focus.
            </p>
          </div>
        ) : (
          <StaggerList className="space-y-2">
            {reviews.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <ReviewCard review={r} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>

      <ReviewPanel open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
