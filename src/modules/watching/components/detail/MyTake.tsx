"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "@/shared/utils/toast";
import { isDemoReadOnlyError } from "@/shared/utils/demo-guard";
import { useUpdateMedia } from "../../hooks/useUpdateMedia";
import { useRatingStanding } from "../../hooks/useRatingPercentile";
import { RatingPicker, ratingLabel } from "../shared/RatingPicker";
import { Panel } from "@/shared/components/ui/panel";
import { Hint } from "@/shared/components/ui/tooltip";
import type { WatchingMedia } from "../../types";

// ── My Take ─────────────────────────────────────────────────────────────────────
// Rating + note = ONE verdict, one card. Reads as typography (no permanent form
// chrome); click to edit; autosaves debounced. Empty state stays compact: the
// picker is the cheapest capture, the note is a single ghost line until wanted.
// want_to_watch: hidden entirely unless a note exists (or the StatusBar's
// "Add a note" forces the editor open) — never an empty form in the premium zone.

const AUTOSAVE_MS = 800;

interface Props {
  media: WatchingMedia;
  /** StatusBar "Add a note" (want_to_watch) → reveal the editor. */
  forceNoteOpen?: boolean;
}

const TYPE_WORD: Record<string, string> = { film: "films", serie: "series", anime: "animes" };

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

  // Where this score sits among YOUR ratings of the same type (null below a real sample).
  const standing = useRatingStanding(media.user_id ?? null, media.type, rating);
  const typeWord = TYPE_WORD[media.type] ?? "titles";
  const reviewedOn = media.note_updated_at
    ? new Date(media.note_updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  // want_to_watch with nothing to show → no card at all (the empty state is
  // resolved by absence, not by an empty form).
  if (isUnwatched && !hasNote && !forceNoteOpen) return null;

  // The score IS the title — a "My Take" heading above a 9.5 only repeats it. But when
  // there's no score (a note on something you haven't watched), the label is the ONLY thing
  // saying these words are yours and not the synopsis. So it appears exactly then.
  const savedFlash_ = (
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
  );

  return (
    <Panel
      title={rating > 0 ? undefined : "My Take"}
      actions={rating > 0 ? undefined : savedFlash_}
    >
      <div>
        {/* Verdict — the number, the word, and where it stands among your own ratings */}
        {!isUnwatched && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-baseline gap-2">
                {rating > 0 ? (
                  <>
                    <span className="text-4xl font-bold leading-none tabular-nums text-text-primary">{rating}</span>
                    <span className="text-sm text-text-tertiary">/ 10</span>
                    <span className="text-sm font-semibold text-amber-400">{ratingLabel(rating)}</span>
                  </>
                ) : (
                  <span className="text-body text-text-secondary">How was it?</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* No header to live in when the score is the title — the flash rides here. */}
                {rating > 0 && savedFlash_}
                {standing && (
                  <p className="max-w-50 text-right text-[11px] leading-snug text-text-tertiary">
                    {standing.elite && (
                      <span className="mb-0.5 block text-caption uppercase tracking-wide text-amber-400">
                        Top {Math.max(1, Math.round((standing.rank / standing.total) * 100))}% of your {typeWord}
                      </span>
                    )}
                    You rate it above{" "}
                    <span className="font-semibold text-text-secondary">{standing.beats}%</span>{" "}
                    of your {typeWord}
                  </p>
                )}
              </div>
            </div>

            <RatingPicker
              showValue={false}
              className="mt-3 max-w-2xl"
              value={rating}
              onChange={(v) => { setRating(v); schedule({ notes, rating: v }); }}
            />
          </>
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
          <Hint label="Click to edit">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setEditing(true)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
              className="cursor-text whitespace-pre-wrap text-body leading-7 text-text-primary/90 transition-colors hover:text-text-primary"
            >
              {notes}
            </div>
          </Hint>
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

        {/* When you wrote it. Stamped by the DB only when the note itself changes — so it
            dates the review, not the last time you bumped an episode. */}
        {hasNote && !showEditor && reviewedOn && (
          <p className="mt-4 text-[11px] text-text-tertiary/70">Reviewed on {reviewedOn}</p>
        )}
      </div>
    </Panel>
  );
}
