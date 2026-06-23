"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Target, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import { cn } from "@/shared/utils/utils";
import { JournalContextChips } from "./JournalContextChips";
import type { JournalContextItem } from "../types";

const ACCENT = "var(--color-accent-journal-vivid)";
const GOALS = "var(--color-accent-goals)";

type Mode = "write" | "preview";

interface JournalEditorProps {
  content: string;
  tags: string[];
  onContentChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
  /** Draft goal link (part of the draft — saved with the entry). */
  goalId?: string | null;
  onGoalChange?: (goalId: string | null) => void;
  /** Attached cross-module context (part of the draft — shown next to the goal). */
  context?: JournalContextItem[];
  onContextChange?: (items: JournalContextItem[]) => void;
  placeholder?: string;
  /** Inline field look (sliding panel) — no card chrome, auto-growing textarea. */
  bare?: boolean;
}

// Goal picker — link an entry to a goal (reflect on a specific objective).
function GoalControl({ goalId, onChange }: { goalId: string | null; onChange: (id: string | null) => void }) {
  const { data: goals = [] } = useGoals();
  const [open, setOpen] = useState(false);
  const active = goals.filter((g) => g.status === "active" || g.id === goalId);
  const current = goals.find((g) => g.id === goalId) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-2"
        >
          <Target size={13} className={current ? "" : "text-text-tertiary"} style={current ? { color: GOALS } : undefined} />
          {current ? <span className="max-w-40 truncate">{current.title}</span> : <span className="text-text-tertiary">Link goal</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 border-border-strong bg-surface-3 p-1">
        <button
          type="button"
          onClick={() => { onChange(null); setOpen(false); }}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
            !goalId ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
          )}
        >
          No goal {!goalId && <Check size={11} className="ml-auto" />}
        </button>
        {active.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { onChange(g.id); setOpen(false); }}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
              goalId === g.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2",
            )}
          >
            <Target size={12} className="shrink-0" style={{ color: GOALS }} />
            <span className="truncate">{g.title}</span>
            {goalId === g.id && <Check size={11} className="ml-auto shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function JournalEditor({
  content,
  tags,
  onContentChange,
  onTagsChange,
  onSave,
  dirty,
  saving,
  goalId,
  onGoalChange,
  context,
  onContextChange,
  placeholder = "What's on your mind?",
  bare = false,
}: JournalEditorProps) {
  const [tagInput, setTagInput] = useState("");
  const [mode, setMode] = useState<Mode>("write");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Bare mode flows in a scrolling panel → auto-grow the textarea to fit content.
  useEffect(() => {
    const el = taRef.current;
    if (!bare || !el || mode !== "write") return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content, bare, mode]);

  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const hasContent = content.trim().length > 0;

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        const trimmed = tagInput.trim().slice(0, 30);
        if (!tags.includes(trimmed) && tags.length < 10) onTagsChange([...tags, trimmed]);
        setTagInput("");
      }
    },
    [tagInput, tags, onTagsChange],
  );

  const removeTag = useCallback(
    (tagToRemove: string) => onTagsChange(tags.filter((t) => t !== tagToRemove)),
    [tags, onTagsChange],
  );

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <div className={cn("flex flex-col", bare ? "" : "h-full rounded-card surface-card")}>
      {/* Toolbar — goal link (left) + Write / Preview (right) */}
      <div className={cn("flex items-start justify-between gap-2", bare ? "" : "px-5 pt-4")}>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {onGoalChange && <GoalControl goalId={goalId ?? null} onChange={onGoalChange} />}
          {context && context.length > 0 && (
            <JournalContextChips
              items={context}
              onRemove={
                onContextChange
                  ? (i) => onContextChange(context.filter((_, idx) => idx !== i))
                  : undefined
              }
            />
          )}
        </div>
        {hasContent && (
          <SegmentedControl<Mode>
            size="sm"
            value={mode}
            onChange={setMode}
            items={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
          />
        )}
      </div>

      {/* Editor / preview area */}
      <div className={cn(bare ? "py-3" : "min-h-0 flex-1 px-8 py-4")}>
        {mode === "write" ? (
          <div
            className={cn(
              bare
                ? "rounded-control border border-border-default bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3 focus-within:border-border-focus focus-within:bg-surface-3"
                : "h-full",
            )}
          >
            <textarea
              ref={taRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onKeyDown={onTextKeyDown}
              placeholder={placeholder}
              className={cn(
                "w-full resize-none bg-transparent text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary",
                bare ? "min-h-[42vh] overflow-hidden" : "h-full",
              )}
              style={{ caretColor: ACCENT }}
            />
          </div>
        ) : (
          <div
            className={cn(
              "journal-prose",
              bare
                ? "min-h-[42vh] rounded-control bg-surface-2 px-3 py-2.5"
                : "h-full overflow-y-auto custom-scrollbar",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Bottom bar — tags + word count + Save */}
      <div className={cn("flex items-center justify-between border-t border-border-subtle", bare ? "py-3" : "px-8 py-4")}>
        <div className="flex flex-1 items-center gap-2">
          <AnimatePresence initial={false}>
            {tags.map((tag) => (
              <motion.div
                key={tag}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 rounded-chip bg-surface-2 px-2 py-1 text-sm"
                style={{ color: ACCENT }}
              >
                <span>{tag}</span>
                <button type="button" onClick={() => removeTag(tag)} className="transition-opacity hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {tags.length < 10 && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tag…"
              maxLength={30}
              className="w-32 bg-transparent text-sm text-text-secondary outline-none placeholder:text-text-tertiary"
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-text-tertiary">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          {dirty ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: ACCENT }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
          ) : (
            hasContent && (
              <span className="flex items-center gap-1 text-xs text-text-tertiary">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
