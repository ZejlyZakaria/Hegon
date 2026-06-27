/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Calendar, ChevronLeft, Loader2, Plus, Search, Tag, Upload, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/utils/utils";

import { useCreateBook } from "../hooks/useBooks";
import { useBookSearch } from "../hooks/useBookSearch";
import { uploadBookCover } from "../service";
import type { BookSearchResult, BookStatus } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  want_to_read: "Want to Read",
  reading: "Reading",
  read: "Read",
};

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").trim();

// Does an image actually load? (Open Library 404s via ?default=false when it has
// no cover → resolves false, so the picker only ever shows real covers.)
function loadable(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth > 1);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export function AddBookModal({ isOpen, onClose }: AddBookModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BookStatus>("want_to_read");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualPages, setManualPages] = useState("");

  // Hero / cover picker
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [validCovers, setValidCovers] = useState<string[]>([]);
  const [coversLoading, setCoversLoading] = useState(false);
  const [chosenCover, setChosenCover] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selectToken = useRef(0);

  const { data: searchResults, isLoading: isSearching, isError: searchError } = useBookSearch(searchQuery);
  const createBook = useCreateBook();

  // Revoke the custom-cover object URL whenever it changes / unmounts.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const openBook = (result: BookSearchResult) => {
    const token = ++selectToken.current;
    setSelected(result);
    setValidCovers([]);
    setChosenCover(null);
    setCustomFile(null);
    setPreviewUrl(null);
    setCoversLoading(true);
    (async () => {
      const checked = await Promise.all(
        result.cover_candidates.map(async (c) => ((await loadable(c)) ? c.replace("?default=false", "") : null)),
      );
      if (selectToken.current !== token) return; // a newer pick superseded this
      const valid = checked.filter((x): x is string => !!x);
      setValidCovers(valid);
      setChosenCover(valid[0] ?? null);
      setCoversLoading(false);
    })();
  };

  const onCustomFile = (file: File) => {
    setCustomFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setChosenCover(url);
  };

  const handleAdd = async () => {
    if (!selected || adding) return;
    setAdding(true);
    try {
      let cover = chosenCover;
      if (customFile) {
        cover = (await uploadBookCover(customFile)) ?? null;
      }
      await createBook.mutateAsync({
        title: selected.title,
        author: selected.author,
        cover_url: cover,
        external_id: selected.external_id,
        year: selected.year,
        genre: selected.genre,
        total_pages: selected.total_pages,
        description: selected.description,
        status: selectedStatus,
      });
      handleClose();
    } catch {
      setAdding(false);
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
    setSelected(null);
    setValidCovers([]);
    setChosenCover(null);
    setCustomFile(null);
    setPreviewUrl(null);
    setAdding(false);
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) handleClose();
  };

  const ambient = chosenCover ?? validCovers[0] ?? null;
  const isCustomChosen = !!previewUrl && chosenCover === previewUrl;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl flex flex-col max-h-[85vh] gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-sm font-semibold text-text-primary">Add Book</DialogTitle>
        </DialogHeader>

        {/* Status selector */}
        <div className="px-5 pb-3 flex items-center gap-2 shrink-0">
          <span className="text-xs text-text-tertiary">Add to:</span>
          <div className="flex items-center gap-1.5">
            {(["want_to_read", "reading", "read"] as BookStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className="px-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: selectedStatus === status ? ACCENT : "var(--color-text-tertiary)" }}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
          {selected ? (
            /* ── Hero ─────────────────────────────────────────────────── */
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="-ml-1 flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to results
              </button>

              {/* hero card with cover-matched ambient bg */}
              <div className="relative flex gap-4 overflow-hidden rounded-xl border border-border-subtle bg-surface-2/40 p-4">
                {ambient && (
                  <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-45 blur-3xl">
                    <img src={ambient} alt="" className="h-full w-full object-cover" />
                  </div>
                )}

                {/* cover + custom upload */}
                <div className="group relative shrink-0">
                  <div className="aspect-2/3 w-24 overflow-hidden rounded-lg border border-border-subtle bg-surface-2">
                    {coversLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                      </div>
                    ) : chosenCover ? (
                      <img src={chosenCover} alt={selected.title} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-5 w-5 text-text-tertiary" />
                      </div>
                    )}
                  </div>
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-lg bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <Upload className="mb-1 h-4 w-4 text-white" />
                    <span className="text-[10px] font-medium text-white">Custom</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onCustomFile(f);
                      }}
                    />
                  </label>
                </div>

                {/* info */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h4 className="text-sm font-semibold leading-tight text-text-primary">{selected.title}</h4>
                  {selected.author && <p className="text-xs text-text-secondary">{selected.author}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                    {selected.year && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {selected.year}
                      </span>
                    )}
                    {selected.total_pages && <span>· {selected.total_pages} pages</span>}
                  </div>
                  {selected.genre.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selected.genre.slice(0, 2).map((g) => (
                        <span key={g} className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-secondary">
                          <Tag size={8} style={{ color: ACCENT }} />
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {selected.description && (
                    <p className="line-clamp-3 pt-0.5 text-[11px] italic leading-relaxed text-text-tertiary">
                      {stripHtml(selected.description)}
                    </p>
                  )}
                </div>
              </div>

              {/* cover picker */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-text-tertiary">Cover</span>
                <div className="flex flex-wrap gap-2">
                  {validCovers.map((cover) => (
                    <button
                      key={cover}
                      type="button"
                      onClick={() => { setChosenCover(cover); setCustomFile(null); }}
                      className={cn(
                        "aspect-2/3 w-11 shrink-0 overflow-hidden rounded-[4px] border-2 transition-colors",
                        chosenCover === cover && !isCustomChosen ? "border-accent-books-vivid" : "border-transparent hover:border-border-default",
                      )}
                    >
                      <img src={cover} alt="" className="h-full w-full object-contain" />
                    </button>
                  ))}

                  {/* custom upload tile */}
                  <label
                    className={cn(
                      "flex aspect-2/3 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[4px] border-2 transition-colors",
                      isCustomChosen ? "border-accent-books-vivid" : "border-dashed border-border-default hover:border-border-strong",
                    )}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Upload className="h-4 w-4 text-text-tertiary" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onCustomFile(f);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelected(null)}
                  className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding}
                  className="h-8 gap-1.5 px-3 text-white hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: ACCENT }}
                >
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add to {STATUS_LABELS[selectedStatus]}
                </Button>
              </div>
            </div>
          ) : !showManualForm ? (
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
                  className="pl-9 pr-9 bg-surface-2 focus:border-border-focus"
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

              {isSearching && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
                </div>
              )}

              {!isSearching && (searchError || (searchResults && searchResults.length === 0)) && searchQuery.length >= 3 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <p className="text-sm text-text-tertiary">No results found</p>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="text-xs transition-opacity hover:opacity-80"
                    style={{ color: ACCENT }}
                  >
                    Add manually instead
                  </button>
                </div>
              )}

              {!isSearching && searchResults && searchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.external_id}
                      type="button"
                      onClick={() => openBook(result)}
                      className="flex gap-3 p-3 bg-surface-2 hover:bg-surface-3 rounded-control border border-border-subtle transition-colors text-left"
                    >
                      <div className="relative aspect-2/3 w-(--cover-sm) shrink-0 bg-surface-2 rounded-[4px] overflow-hidden">
                        {result.cover_candidates.length > 0 ? (
                          <ResultCover candidates={result.cover_candidates} alt={result.title} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen className="h-4 w-4 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{result.title}</p>
                        {result.author && <p className="text-xs text-text-secondary mt-0.5">{result.author}</p>}
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

              {!searchQuery && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <p className="text-sm text-text-tertiary">Search for a book to add</p>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(true)}
                    className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                    style={{ color: ACCENT }}
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
                  className="bg-surface-2 focus:border-border-focus"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Author</label>
                <Input
                  variant="tasks"
                  value={manualAuthor}
                  onChange={(e) => setManualAuthor(e.target.value)}
                  placeholder="Enter author name"
                  className="bg-surface-2 focus:border-border-focus"
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
                  className="bg-surface-2 focus:border-border-focus"
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

// Result-list cover with fallback chain (Open Library → Google).
function ResultCover({ candidates, alt }: { candidates: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const src = candidates[i];
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <BookOpen className="h-4 w-4 text-text-tertiary" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="eager" className="h-full w-full object-contain" onError={() => setI((n) => n + 1)} />;
}
