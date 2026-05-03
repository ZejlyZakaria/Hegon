"use client";

import { useState } from "react";
import { BookOpen, Loader2, Plus, Search, X } from "lucide-react";
import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

import { useCreateBook } from "../hooks/useBooks";
import { useBookSearch } from "../hooks/useBookSearch";
import type { BookSearchResult, BookStatus } from "../types";

const ACCENT = "var(--color-accent-books)";

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  want_to_read: "Want to Read",
  reading: "Reading",
  read: "Read",
};

export function AddBookModal({ isOpen, onClose }: AddBookModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("want_to_read");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualPages, setManualPages] = useState("");

  const { data: searchResults, isLoading: isSearching } = useBookSearch(searchQuery);
  const createBook = useCreateBook();

  const handleSelectBook = async (result: BookSearchResult) => {
    try {
      await createBook.mutateAsync({
        title: result.title,
        author: result.author,
        cover_url: result.cover_url,
        external_id: result.external_id,
        year: result.year,
        genre: result.genre,
        total_pages: result.total_pages,
        description: result.description,
        status: selectedStatus,
      });
      handleClose();
    } catch {
      // toast handled by onError in the mutation
    }
  };

  const handleManualAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    try {
      await createBook.mutateAsync({
        title: manualTitle.trim(),
        author: manualAuthor.trim() || null,
        total_pages: manualPages ? parseInt(manualPages) : null,
        status: selectedStatus,
      });
      handleClose();
    } catch {
      // toast handled by onError in the mutation
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setShowManualForm(false);
    setSelectedStatus("want_to_read");
    setManualTitle("");
    setManualAuthor("");
    setManualPages("");
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-surface-3 border-border-strong flex flex-col max-h-[80vh] gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 shrink-0">
          <DialogTitle className="text-sm font-semibold text-text-primary">
            Add Book
          </DialogTitle>
        </DialogHeader>

        {/* Status selector */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-tertiary">Add to:</span>
          <div className="flex items-center gap-1.5">
            {(["want_to_read", "reading", "read"] as BookStatus[]).map((status) => {
              const isActive = selectedStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setSelectedStatus(status)}
                  className="px-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    color: isActive ? "var(--color-accent-books)" : "#71717a",
                  }}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {!showManualForm ? (
            <>
              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <Input
                  variant="tasks"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or author…"
                  autoFocus
                  className="pl-9 pr-9 bg-surface-overlay focus:border-border-focus"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Searching */}
              {isSearching && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
                </div>
              )}

              {/* No results */}
              {!isSearching && searchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <p className="text-sm text-text-tertiary">No results found</p>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="text-xs transition-opacity hover:opacity-80"
                    style={{ color: "var(--color-accent-books)" }}
                  >
                    Add manually instead
                  </button>
                </div>
              )}

              {/* Results */}
              {!isSearching && searchResults && searchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.external_id}
                      type="button"
                      onClick={() => handleSelectBook(result)}
                      disabled={createBook.isPending}
                      className="flex gap-3 p-3 bg-surface-2 hover:bg-surface-overlay rounded-lg border border-white/4 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="relative w-10 h-14 shrink-0 bg-surface-overlay rounded overflow-hidden">
                        {result.cover_url ? (
                          <Image src={result.cover_url} alt={result.title} fill sizes="40px" className="object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{result.title}</p>
                        {result.author && (
                          <p className="text-xs text-text-secondary mt-0.5">{result.author}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                          {result.year && <span>{result.year}</span>}
                          {result.total_pages && (
                            <>
                              <span>·</span>
                              <span>{result.total_pages} pages</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty — no query */}
              {!searchQuery && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <p className="text-sm text-text-tertiary">Search for a book to add</p>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                    style={{ color: "var(--color-accent-books)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Or add manually
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Manual form */
            <form onSubmit={handleManualAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Title <span style={{ color: ACCENT }}>*</span>
                </label>
                <Input
                  variant="tasks"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Enter book title"
                  autoFocus
                  required
                  className="bg-surface-overlay focus:border-border-focus"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Author</label>
                <Input
                  variant="tasks"
                  value={manualAuthor}
                  onChange={(e) => setManualAuthor(e.target.value)}
                  placeholder="Enter author name"
                  className="bg-surface-overlay focus:border-border-focus"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Total Pages</label>
                <Input
                  variant="tasks"
                  type="number"
                  min="1"
                  value={manualPages}
                  onChange={(e) => setManualPages(e.target.value)}
                  placeholder="Number of pages"
                  className="bg-surface-overlay focus:border-border-focus"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowManualForm(false)}
                  className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={createBook.isPending || !manualTitle.trim()}
                  className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {createBook.isPending ? "Adding…" : "Add Book"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
