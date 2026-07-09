"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import type { WatchingMedia } from "../../types";

// ── Rating Slider ──────────────────────────────────────────────────────────────
// Token colors (not white-on-teal): it lives on surface cards and in AddMediaModal.

export function ratingLabel(value: number): string | null {
  return value >= 9.5 ? "Masterpiece"
    : value >= 8   ? "Great"
    : value >= 7   ? "Good"
    : value >= 5   ? "Decent"
    : value >= 3   ? "Not for me"
    : value > 0    ? "Skip it"
    : null;
}

export function RatingSlider({ value, onChange, showValue = true }: {
  value: number; onChange: (v: number) => void; showValue?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const onChangeRef = useRef<(v: number) => void>(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const setFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const { left, width } = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    const v = Math.round(Math.max(1, Math.min(10, ratio * 9 + 1)) * 2) / 2;
    onChangeRef.current(v);
  };

  useEffect(() => {
    const onMove  = (e: MouseEvent) => { if (isDragging.current) setFromClientX(e.clientX); };
    const onTouch = (e: TouchEvent) => { if (isDragging.current && e.touches[0]) setFromClientX(e.touches[0].clientX); };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const isUnrated = value <= 0;
  const fillPercent = isUnrated ? 0 : ((value - 1) / 9) * 100;
  const label = ratingLabel(value);

  return (
    <div className="select-none">
      {/* Scale on top — numbers above the track so a dragging finger never covers the
          number it's selecting; each is centered on its knob position. */}
      <div className="relative mb-2.5 h-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span
            key={n}
            className="absolute -translate-x-1/2 text-caption tabular-nums text-white/40"
            style={{ left: `${((n - 1) / 9) * 100}%` }}
          >
            {n}
          </span>
        ))}
      </div>
      {/* Tall, touch-friendly hit band — the whole strip (knob included) is grabbable
          and shows the pointer; touch-none lets a finger drag without scrolling. */}
      <div
        className="relative cursor-pointer touch-none py-2.5"
        onMouseDown={(e) => { e.preventDefault(); isDragging.current = true; setFromClientX(e.clientX); }}
        onTouchStart={(e) => { isDragging.current = true; if (e.touches[0]) setFromClientX(e.touches[0].clientX); }}
      >
        {/* Unrated: dimmed empty track, no knob — a knob-at-left reads as "1/10". */}
        <div ref={trackRef} className={`relative h-0.75 w-full rounded-full ${isUnrated ? "bg-white/8" : "bg-black/25"}`}>
          {!isUnrated && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300"
                style={{ transform: `scaleX(${fillPercent / 100})`, transition: "transform 90ms cubic-bezier(0.22,1,0.36,1)" }}
              />
              <div
                className="pointer-events-none absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full bg-white"
                style={{ left: `${fillPercent}%`, boxShadow: "0 1px 3px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(0,0,0,0.15)" }}
              />
            </>
          )}
        </div>
      </div>
      {showValue && (
        <div className="mt-2 flex items-baseline gap-2">
          {value > 0 ? (
            <>
              <span className="text-3xl font-bold tabular-nums text-text-primary">{value}</span>
              <span className="text-sm text-text-secondary">/ 10</span>
              {label && <span className="text-sm font-medium text-amber-400">{label}</span>}
            </>
          ) : (
            <span className="text-xs text-white/55">Tap to rate</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── My Take ─────────────────────────────────────────────────────────────────────
// Rating + note = ONE verdict, one card. Reads as typography (no permanent form
// chrome); click to edit; autosaves debounced. Empty state stays compact: the
// slider is the cheapest capture, the note is a single ghost line until wanted.
// want_to_watch: hidden entirely unless a note exists (or the StatusBar's
// "Add a note" forces the editor open) — never an empty form in the premium zone.

const AUTOSAVE_MS = 800;

interface Props {
  media: WatchingMedia;
  /** StatusBar "Add a note" (want_to_watch) → reveal the editor. */
  forceNoteOpen?: boolean;
}

export function MyTake({ media, forceNoteOpen }: Props) {
  const updateMedia = useUpdateMedia();
  const isUnwatched = !!(media.is_reference || (media.want_to_watch && !media.watched && !media.in_progress));

  const [rating, setRating] = useState(media.user_rating ?? 0);
  const [notes, setNotes] = useState(media.notes ?? "");
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const mediaIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ notes: string; rating: number } | null>(null);

  useEffect(() => {
    if (media.id !== mediaIdRef.current) {
      mediaIdRef.current = media.id;
      setRating(media.user_rating ?? 0);
      setNotes(media.notes ?? "");
      setEditing(false);
      pendingRef.current = null;
    }
  }, [media]);

  // Flush a pending edit if the user leaves before the debounce fires.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (flashRef.current) clearTimeout(flashRef.current);
    if (pendingRef.current && mediaIdRef.current) {
      const p = pendingRef.current;
      updateMedia.mutate({ id: mediaIdRef.current, notes: p.notes, user_rating: p.rating > 0 ? p.rating : null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (next: { notes: string; rating: number }) => {
    pendingRef.current = null;
    try {
      await updateMedia.mutateAsync({ id: media.id, notes: next.notes, user_rating: next.rating > 0 ? next.rating : null });
      setSavedFlash(true);
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setSavedFlash(false), 1400);
    } catch (err) {
      // Demo read-only: the guard already toasts — put the truth back on screen.
      setNotes(media.notes ?? "");
      setRating(media.user_rating ?? 0);
      if (isDemoReadOnlyError(err)) return;
      toast.error("Failed to save.");
    }
  };

  const schedule = (next: { notes: string; rating: number }) => {
    pendingRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(next), AUTOSAVE_MS);
  };

  const flushNow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingRef.current) save(pendingRef.current);
  };

  const hasNote = notes.trim().length > 0;
  const showEditor = editing || (isUnwatched && forceNoteOpen && !hasNote);

  // want_to_watch with nothing to show → no card at all (the empty state is
  // resolved by absence, not by an empty form).
  if (isUnwatched && !hasNote && !forceNoteOpen) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-title text-text-primary">My Take</h2>
        <AnimatePresence>
          {savedFlash && (
            <motion.span
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
              className="text-caption uppercase text-text-tertiary"
            >
              Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="surface-card rounded-card p-5">
        {/* Verdict row — the number and the gesture are one line, one thing */}
        {!isUnwatched && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="min-w-28 shrink-0 pb-0.5">
              {rating > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums leading-none text-text-primary">{rating}</span>
                  <span className="text-sm text-text-secondary">/ 10</span>
                  <span className="text-sm font-medium text-amber-400">{ratingLabel(rating)}</span>
                </div>
              ) : (
                <span className="text-body text-text-secondary">How was it?</span>
              )}
            </div>
            {/* Constrained: a 1→10 scale loses all meaning stretched across the column */}
            <div className="w-full max-w-sm flex-1 sm:w-auto">
              <RatingSlider
                showValue={false}
                value={rating}
                onChange={(v) => { setRating(v); schedule({ notes, rating: v }); }}
              />
            </div>
          </div>
        )}

        {!isUnwatched && <div className="my-4 h-px bg-border-subtle" />}

        {/* Note — journal typography first, seamless editor on demand */}
        {showEditor ? (
          <textarea
            autoFocus
            value={notes}
            spellCheck={false}
            ref={(el) => {
              if (el) { el.style.height = "0"; el.style.height = `${Math.max(el.scrollHeight, 56)}px`; }
            }}
            onChange={(e) => {
              setNotes(e.target.value);
              schedule({ notes: e.target.value, rating });
              e.target.style.height = "0";
              e.target.style.height = `${Math.max(e.target.scrollHeight, 56)}px`;
            }}
            onBlur={() => { setEditing(false); flushNow(); }}
            placeholder={isUnwatched ? "Why do you want to watch this?" : "What did you think? Was it worth your time?"}
            className="w-full resize-none overflow-hidden bg-transparent text-body leading-7 text-text-primary placeholder:text-text-tertiary/60 focus:outline-none"
          />
        ) : hasNote ? (
          <div
            role="button"
            tabIndex={0}
            title="Edit"
            onClick={() => setEditing(true)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
            className="cursor-text whitespace-pre-wrap text-body leading-7 text-text-primary/90 transition-colors hover:text-text-primary"
          >
            {notes}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 py-1 text-label text-text-tertiary transition-colors hover:text-text-primary"
          >
            <Plus size={13} />
            Add a note
          </button>
        )}
      </div>
    </section>
  );
}
