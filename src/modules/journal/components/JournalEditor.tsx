"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { JournalEntry } from "../types";

interface JournalEditorProps {
  entry: JournalEntry | null;
  onSave: (data: { content: string; tags: string[] }) => void;
  placeholder?: string;
}

export function JournalEditor({ 
  entry, 
  onSave,
  placeholder = "What's on your mind?"
}: JournalEditorProps) {
  const [content, setContent] = useState(entry?.content ?? "");
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Auto-save with 2s debounce
  // Note: use key={entry?.id} on this component at the parent level to reset state when entry changes
  useEffect(() => {
    if (!entry) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      onSaveRef.current({ content, tags });

      setShowSaved(true);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setShowSaved(false), 2000);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  // onSave intentionally excluded — stored in ref to avoid re-triggering on parent re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, tags, entry?.id]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // Calculate word count
  const wordCount = content.trim() === "" 
    ? 0 
    : content.trim().split(/\s+/).length;

  // Handle tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 rounded-lg">
      {/* Editor area */}
      <div className="flex-1 px-8 py-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full bg-transparent text-text-primary placeholder:text-text-tertiary resize-none outline-none"
          style={{
            caretColor: '#f97316', // Orange cursor
          }}
        />
      </div>

      {/* Bottom bar: Tags + Word count + Saved indicator */}
      <div className="flex items-center justify-between px-8 py-4 border-t border-border-subtle">
        {/* Tags section */}
        <div className="flex items-center gap-2 flex-1">
          {/* Tag chips */}
          <AnimatePresence initial={false}>
            {tags.map((tag) => (
              <motion.div
                key={tag}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-surface-2"
                style={{ color: '#f97316' }}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Tag input */}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag..."
            className="bg-transparent text-text-secondary placeholder:text-text-tertiary outline-none text-sm w-32"
          />
        </div>

        {/* Right side: Word count + Saved indicator */}
        <div className="flex items-center gap-4">
          {/* Word count */}
          <span className="text-sm text-text-tertiary">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>

          {/* Saved indicator */}
          <AnimatePresence>
            {showSaved && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm flex items-center gap-1"
                style={{ color: '#f97316' }}
              >
                <span>Saved</span>
                <span>✓</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}