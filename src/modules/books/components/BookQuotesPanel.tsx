"use client";

import { useState } from "react";
import { Quote, Plus, Star, Trash2, Check, Pencil } from "lucide-react";
import {
  useBookQuotes,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
} from "../hooks/useBookQuotes";
import type { BookQuote } from "../types";

const ACCENT = "var(--color-accent-books-vivid)";

// ── Add / edit form ─────────────────────────────────────────────────────────

function QuoteForm({
  initialText = "",
  initialPage = "",
  pending,
  onCancel,
  onSubmit,
}: {
  initialText?: string;
  initialPage?: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (text: string, page: number | null) => void;
}) {
  const [text, setText] = useState(initialText);
  const [page, setPage] = useState(initialPage);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const p = page.trim() ? parseInt(page, 10) : NaN;
    onSubmit(t, Number.isNaN(p) ? null : p);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-1 p-3">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type the passage…"
        rows={3}
        className="resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-white/15"
      />
      <div className="flex items-center gap-2">
        <input
          value={page}
          onChange={(e) => setPage(e.target.value)}
          type="number"
          min="0"
          placeholder="Page"
          className="w-20 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-white/15"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-1 text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || pending}
            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            <Check size={11} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single quote ────────────────────────────────────────────────────────────

function QuoteItem({ quote, bookId }: { quote: BookQuote; bookId: string }) {
  const updateQuote = useUpdateQuote(bookId);
  const deleteQuote = useDeleteQuote(bookId);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <QuoteForm
        initialText={quote.text}
        initialPage={quote.page != null ? String(quote.page) : ""}
        pending={updateQuote.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={(text, page) =>
          updateQuote.mutate(
            { id: quote.id, text, page },
            { onSuccess: () => setEditing(false) },
          )
        }
      />
    );
  }

  return (
    <div
      className="group relative rounded-xl border border-border-subtle bg-surface-1 py-3 pl-4 pr-3.5"
      style={{ borderLeft: `2px solid ${ACCENT}` }}
    >
      <p className="text-sm italic leading-relaxed text-text-primary">“{quote.text}”</p>

      <div className="mt-2 flex min-h-5 items-center gap-2">
        {quote.page != null && (
          <span className="text-[11px] tabular-nums text-text-tertiary">p. {quote.page}</span>
        )}
        {quote.note && (
          <span className="truncate text-[11px] italic text-text-tertiary">— {quote.note}</span>
        )}

        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => updateQuote.mutate({ id: quote.id, favorite: !quote.favorite })}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2"
            title={quote.favorite ? "Unfavorite" : "Favorite"}
          >
            <Star size={12} className={quote.favorite ? "fill-amber-400 text-amber-400" : "text-text-tertiary"} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            title="Edit"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={() => deleteQuote.mutate(quote.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* idle favorite indicator — hidden while the action row is shown */}
      {quote.favorite && (
        <Star
          size={11}
          className="absolute right-3 top-3 fill-amber-400 text-amber-400 transition-opacity group-hover:opacity-0"
        />
      )}
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────────────

export function BookQuotesPanel({ bookId }: { bookId: string }) {
  const { data: quotes = [], isLoading } = useBookQuotes(bookId);
  const createQuote = useCreateQuote(bookId);
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote size={14} style={{ color: ACCENT }} />
          <h3 className="text-sm font-semibold text-text-primary">Quotes</h3>
          {quotes.length > 0 && <span className="text-xs text-text-tertiary">{quotes.length}</span>}
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-surface-2"
            style={{ color: ACCENT }}
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>

      {adding && (
        <QuoteForm
          pending={createQuote.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(text, page) =>
            createQuote.mutate(
              { book_id: bookId, text, page },
              { onSuccess: () => setAdding(false) },
            )
          }
        />
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-1" />)}
        </div>
      ) : quotes.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-6 text-center">
          <Quote size={20} className="mx-auto text-text-tertiary/40" />
          <p className="mt-2 text-sm text-text-secondary">No quotes yet</p>
          <p className="mt-0.5 text-xs text-text-tertiary">Capture the lines that stayed with you.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {quotes.map((q) => <QuoteItem key={q.id} quote={q} bookId={bookId} />)}
        </div>
      )}
    </section>
  );
}
