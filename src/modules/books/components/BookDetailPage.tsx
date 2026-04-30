"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, MoreHorizontal, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useBook, useUpdateBook, useUpdateProgress } from "../hooks/useBooks";
import { DeleteBookModal } from "./DeleteBookModal";
import { BookDetailSkeleton } from "./BookDetailSkeleton";
import type { BookStatus } from "../types";

const SKY = "#0ea5e9";

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
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface BookDetailPageProps {
  id: string;
}

export function BookDetailPage({ id }: BookDetailPageProps) {
  const router = useRouter();
  const { data: book, isLoading } = useBook(id);
  const updateBook     = useUpdateBook();
  const updateProgress = useUpdateProgress();

  const [notes, setNotes]               = useState("");
  const [notesDirty, setNotesDirty]     = useState(false);
  const [currentPage, setCurrentPage]   = useState("");
  const [pageError, setPageError]       = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [showMenu, setShowMenu]         = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (book) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(book.notes ?? "");
      setCurrentPage(String(book.current_page ?? 0));
    }
  }, [book]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleStatusChange = useCallback((newStatus: BookStatus) => {
    if (!book || newStatus === book.status) return;
    const today = toLocalDate();
    const update: Parameters<typeof updateBook.mutate>[0] = { id: book.id, status: newStatus };

    switch (newStatus) {
      case "reading":
        update.started_at  = book.started_at ?? today;
        update.finished_at = null;
        // Re-reading from scratch — reset progress
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
      // paused / abandoned — snapshot, no side effects
    }

    updateBook.mutate(update);
  }, [book, updateBook]);

  const handleRating = (star: number) => {
    if (!book) return;
    updateBook.mutate({ id: book.id, rating: book.rating === star ? null : star });
  };

  const handleProgressUpdate = () => {
    if (!book) return;
    const page = parseInt(currentPage);
    if (isNaN(page) || page < 0) return;

    if (book.total_pages && page > book.total_pages) {
      setPageError(`Max is ${book.total_pages} pages`);
      return;
    }
    setPageError(null);

    // Auto-complete when last page reached
    if (book.total_pages && page === book.total_pages) {
      updateBook.mutate({
        id:          book.id,
        status:      "read",
        current_page: page,
        finished_at: toLocalDate(),
      });
    } else {
      updateProgress.mutate({ id: book.id, current_page: page });
    }
  };

  const handleNotesSave = () => {
    if (!book) return;
    updateBook.mutate(
      { id: book.id, notes: notes.trim() || null },
      { onSuccess: () => setNotesDirty(false) }
    );
  };

  const handleBack = () => {
    if (notesDirty) {
      if (!window.confirm("You have unsaved notes. Leave anyway?")) return;
    }
    router.back();
  };

  if (isLoading) return <BookDetailSkeleton />;
  if (!book) return (
    <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
      Book not found.
    </div>
  );

  const progress =
    book.total_pages && book.current_page
      ? Math.round((book.current_page / book.total_pages) * 100)
      : 0;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-4 pb-3 shrink-0 flex items-center">
          <motion.button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Books
          </motion.button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <motion.div
            className="flex gap-6 max-w-4xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >

            {/* ── Left: Cover + metadata ── */}
            <div className="w-44 shrink-0 flex flex-col gap-3">
              {/* Cover */}
              <div className="relative w-full aspect-2/3 rounded-lg overflow-hidden bg-surface-1 border border-border-subtle">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-text-tertiary" />
                  </div>
                )}
              </div>

              {/* Quick metadata */}
              <div className="flex flex-col gap-1.5">
                {book.year && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary">Year</span>
                    <span className="text-text-secondary">{book.year}</span>
                  </div>
                )}
                {book.total_pages && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary">Pages</span>
                    <span className="text-text-secondary">{book.total_pages}</span>
                  </div>
                )}
                {book.started_at && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary">Started</span>
                    <span className="text-text-secondary">{formatDate(book.started_at)}</span>
                  </div>
                )}
                {book.finished_at && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary">Finished</span>
                    <span className="text-text-secondary">{formatDate(book.finished_at)}</span>
                  </div>
                )}
              </div>

              {/* Genre tags */}
              {book.genre.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {book.genre.map((g) => (
                    <span
                      key={g}
                      className="text-xs text-text-tertiary bg-surface-1 border border-border-subtle px-2 py-0.5 rounded"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: Main content ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* Title + Author + Actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-text-primary leading-tight">
                    {book.title}
                  </h1>
                  {book.author && (
                    <p className="text-sm text-text-secondary mt-1">{book.author}</p>
                  )}
                </div>
                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setShowMenu((v) => !v)}
                    className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-1 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-surface-3 border border-border-strong rounded-lg shadow-lg z-10 py-1">
                      <button
                        type="button"
                        onClick={() => { setShowMenu(false); setDeleteModalOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-surface-2 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete book
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-text-secondary">Status</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  {STATUS_OPTIONS.map(({ value, label }) => {
                    const isActive = book.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleStatusChange(value)}
                        disabled={updateBook.isPending}
                        className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                        style={{ color: isActive ? SKY : "#71717a" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress (reading only) */}
              {book.status === "reading" && (
                <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-secondary">Progress</h3>
                    <span className="text-xs text-text-tertiary">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%`, backgroundColor: SKY }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        variant="tasks"
                        type="number"
                        min="0"
                        value={currentPage}
                        onChange={(e) => { setCurrentPage(e.target.value); setPageError(null); }}
                        className={`w-24 h-8 bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus ${pageError ? "border-red-500/60" : ""}`}
                        placeholder="Page"
                      />
                      {book.total_pages && (
                        <span className="text-xs text-text-tertiary">
                          / {book.total_pages} pages
                        </span>
                      )}
                      <Button
                        type="button"
                        onClick={handleProgressUpdate}
                        disabled={updateProgress.isPending || updateBook.isPending}
                        className="h-8 px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 ml-auto"
                        style={{ backgroundColor: SKY }}
                      >
                        {(updateProgress.isPending || updateBook.isPending) ? "Saving…" : "Update"}
                      </Button>
                    </div>
                    {pageError && (
                      <p className="text-xs text-red-400">{pageError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Rating (read only) */}
              {book.status === "read" && (
                <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-3">
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
                          <Star
                            className="w-5 h-5"
                            fill={filled ? SKY : "none"}
                            stroke={filled ? SKY : "#71717a"}
                            strokeWidth={1.5}
                          />
                        </button>
                      );
                    })}
                    {book.rating && (
                      <span className="text-xs text-text-tertiary ml-1">
                        {book.rating} / 5
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-3">
                  <h3 className="text-xs font-semibold text-text-secondary">Description</h3>
                  <p className={`text-sm text-text-secondary leading-snug ${!descExpanded ? "line-clamp-6" : ""}`}>
                    {book.description}
                  </p>
                  {book.description.length > 350 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="text-xs self-start transition-opacity hover:opacity-70"
                      style={{ color: SKY }}
                    >
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="bg-surface-1 rounded-lg p-4 border border-border-subtle flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-text-secondary">Notes</h3>
                <Textarea
                  variant="tasks"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesDirty(true);
                  }}
                  placeholder="Your thoughts, quotes, key ideas…"
                  className="min-h-28 bg-surface-1 hover:bg-surface-2 border-border-subtle focus:border-border-focus text-sm"
                />
                {notesDirty && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleNotesSave}
                      disabled={updateBook.isPending}
                      className="h-8 px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: SKY }}
                    >
                      {updateBook.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
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

