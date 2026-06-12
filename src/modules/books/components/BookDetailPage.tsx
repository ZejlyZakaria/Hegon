"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, MoreHorizontal, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useBook, useUpdateBook, useUpdateProgress, useUpdateBookNotes } from "../hooks/useBooks";
import { DeleteBookModal } from "./DeleteBookModal";
import { BookDetailSkeleton } from "./BookDetailSkeleton";
import { BookQuotesPanel } from "./BookQuotesPanel";
import type { BookStatus } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";
const MUTED  = "#71717a";

function toLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: "want_to_read", label: "Want to Read" },
  { value: "reading",      label: "Reading"      },
  { value: "read",         label: "Read"         },
  { value: "paused",       label: "Paused"       },
  { value: "abandoned",    label: "Abandoned"    },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface BookDetailPageProps {
  id: string;
}

export function BookDetailPage({ id }: BookDetailPageProps) {
  const router = useRouter();
  const { data: book, isLoading } = useBook(id);
  const updateBook     = useUpdateBook();
  const updateProgress = useUpdateProgress();
  const saveNotes      = useUpdateBookNotes(id);

  const [notes, setNotes]               = useState("");
  const [currentPage, setCurrentPage]   = useState("");
  const [pageError, setPageError]       = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const notesLoadedRef = useRef(false);

  const debouncedNotes = useDebounce(notes, 700);

  // Seed editable fields once the book loads (keyed on id so autosave typing
  // is never clobbered by an unrelated refresh).
  useEffect(() => {
    if (book) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(book.notes ?? "");
      setCurrentPage(String(book.current_page ?? 0));
      notesLoadedRef.current = true;
    }
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reflect external current_page changes (e.g. progress save, re-read reset).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (book) setCurrentPage(String(book.current_page ?? 0));
  }, [book?.current_page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent, debounced autosave for the notes field.
  useEffect(() => {
    if (!book || !notesLoadedRef.current) return;
    const normalized = debouncedNotes.trim() || null;
    if (normalized === (book.notes ?? null)) return;
    saveNotes.mutate(normalized);
  }, [debouncedNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = useCallback((newStatus: BookStatus) => {
    if (!book || newStatus === book.status) return;
    const today = toLocalDate();
    const update: Parameters<typeof updateBook.mutate>[0] = { id: book.id, status: newStatus };
    switch (newStatus) {
      case "reading":
        update.started_at  = book.started_at ?? today;
        update.finished_at = null;
        if (book.status === "read") update.current_page = 0;
        break;
      case "read":
        update.finished_at = today;
        if (book.total_pages) update.current_page = book.total_pages;
        break;
      case "want_to_read":
        update.started_at  = null;
        update.finished_at = null;
        update.current_page = 0;
        break;
    }
    updateBook.mutate(update);
  }, [book, updateBook]);

  const handleRating = (star: number) => {
    if (!book) return;
    updateBook.mutate({ id: book.id, rating: book.rating === star ? null : star });
  };

  const handleProgressUpdate = () => {
    if (!book) return;
    const page = parseInt(currentPage, 10);
    if (isNaN(page) || page < 0) return;
    if (book.total_pages && page > book.total_pages) {
      setPageError(`Max is ${book.total_pages} pages`);
      return;
    }
    setPageError(null);
    if (book.total_pages && page === book.total_pages) {
      updateBook.mutate({ id: book.id, status: "read", current_page: page, finished_at: toLocalDate() });
    } else {
      updateProgress.mutate({ id: book.id, current_page: page });
    }
  };

  if (isLoading) return <BookDetailSkeleton />;
  if (!book) return (
    <div className="flex h-full items-center justify-center text-sm text-text-tertiary">Book not found.</div>
  );

  const progress =
    book.total_pages && book.current_page ? Math.round((book.current_page / book.total_pages) * 100) : 0;

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Back */}
        <div className="flex shrink-0 items-center px-6 pb-3 pt-4">
          <motion.button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Books
          </motion.button>
        </div>

        {/* Body — 3 zones */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <motion.div
            className="grid grid-cols-1 gap-6 lg:grid-cols-[176px_minmax(0,1fr)_340px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* ── Left — cover + metadata (sticky) ── */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-1 lg:self-start">
              <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-1">
                {book.cover_url ? (
                  <Image src={book.cover_url} alt={book.title} fill priority sizes="176px" className="object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-8 w-8 text-text-tertiary" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {book.year && <MetaRow label="Year" value={book.year} />}
                {book.total_pages && <MetaRow label="Pages" value={book.total_pages} />}
                {book.started_at && <MetaRow label="Started" value={formatDate(book.started_at)} />}
                {book.finished_at && <MetaRow label="Finished" value={formatDate(book.finished_at)} />}
              </div>

              {book.genre.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {book.genre.map((g) => (
                    <span key={g} className="rounded border border-border-subtle bg-surface-1 px-2 py-0.5 text-xs text-text-tertiary">{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Center — title + tracking cards ── */}
            <div className="flex min-w-0 flex-col gap-3">
              {/* Title + author + menu */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-text-primary">{book.title}</h1>
                  {book.author && <p className="mt-1 text-sm text-text-secondary">{book.author}</p>}
                </div>
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-1 hover:text-text-primary"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 w-40 overflow-hidden rounded-xl border border-border-strong bg-surface-3 p-1 shadow-md"
                    >
                      <Popover.Close asChild>
                        <button
                          type="button"
                          onClick={() => setDeleteModalOpen(true)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete book
                        </button>
                      </Popover.Close>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
                <h3 className="text-xs font-semibold text-text-secondary">Status</h3>
                <div className="flex flex-wrap items-center gap-4">
                  {STATUS_OPTIONS.map(({ value, label }) => {
                    const isActive = book.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleStatusChange(value)}
                        disabled={updateBook.isPending}
                        className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                        style={{ color: isActive ? ACCENT : MUTED }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress (reading) */}
              {book.status === "reading" && (
                <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-secondary">Progress</h3>
                    <span className="text-xs text-text-tertiary">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress}%`, backgroundColor: ACCENT }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      variant="tasks"
                      type="number"
                      min="0"
                      value={currentPage}
                      onChange={(e) => { setCurrentPage(e.target.value); setPageError(null); }}
                      className={`h-8 w-24 border-border-subtle bg-surface-1 hover:bg-surface-2 ${pageError ? "border-red-500/60" : ""}`}
                      placeholder="Page"
                    />
                    {book.total_pages && <span className="text-xs text-text-tertiary">/ {book.total_pages} pages</span>}
                    <Button
                      type="button"
                      onClick={handleProgressUpdate}
                      disabled={updateProgress.isPending || updateBook.isPending}
                      className="ml-auto h-8 px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {(updateProgress.isPending || updateBook.isPending) ? "Saving…" : "Update"}
                    </Button>
                  </div>
                  {pageError && <p className="text-xs text-red-400">{pageError}</p>}
                </div>
              )}

              {/* Rating (read) */}
              {book.status === "read" && (
                <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
                  <h3 className="text-xs font-semibold text-text-secondary">Rating</h3>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const filled = book.rating != null && i < book.rating;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleRating(i + 1)}
                          disabled={updateBook.isPending}
                          className="transition-opacity hover:opacity-70 disabled:opacity-40"
                        >
                          <Star className="h-5 w-5" fill={filled ? ACCENT : "none"} stroke={filled ? ACCENT : MUTED} strokeWidth={1.5} />
                        </button>
                      );
                    })}
                    {book.rating && <span className="ml-1 text-xs text-text-tertiary">{book.rating} / 5</span>}
                  </div>
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
                  <h3 className="text-xs font-semibold text-text-secondary">Description</h3>
                  <p className={`text-sm leading-snug text-text-secondary ${!descExpanded ? "line-clamp-6" : ""}`}>
                    {book.description}
                  </p>
                  {book.description.length > 350 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="self-start text-xs transition-opacity hover:opacity-70"
                      style={{ color: ACCENT }}
                    >
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {/* Notes — autosave */}
              <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-secondary">Notes</h3>
                  {saveNotes.isPending && <span className="text-[11px] text-text-tertiary/60">Saving…</span>}
                </div>
                <Textarea
                  variant="tasks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Your thoughts, key ideas, takeaways…"
                  className="min-h-28 border-border-subtle bg-surface-1 text-sm hover:bg-surface-2 focus:border-border-focus"
                />
              </div>
            </div>

            {/* ── Right — Quotes ── */}
            <aside className="min-w-0">
              <BookQuotesPanel bookId={book.id} />
            </aside>
          </motion.div>
        </div>
      </div>

      <DeleteBookModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        bookId={book.id}
        bookTitle={book.title}
        onDeleted={() => router.push("/life/books")}
      />
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-secondary">{value}</span>
    </div>
  );
}
