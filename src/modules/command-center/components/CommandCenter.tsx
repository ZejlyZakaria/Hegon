"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Target, Zap, BookOpen, Book, CheckSquare, ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCommandCenter } from "../store";
import { useCommandSearch } from "../hooks/useCommandSearch";
import type { PendingAction } from "../store";
import type { CommandResult, CommandModule } from "../types";

const MODULE_CONFIG: Record<CommandModule, { label: string; color: string; Icon: React.ElementType }> = {
  goals:   { label: "Goals",   color: "#22c55e", Icon: Target },
  habits:  { label: "Habits",  color: "#f43f5e", Icon: Zap },
  journal: { label: "Journal", color: "#f59e0b", Icon: BookOpen },
  books:   { label: "Books",   color: "#f97316", Icon: Book },
  tasks:   { label: "Tasks",   color: "#71717a", Icon: CheckSquare },
};

const MODULE_ORDER: CommandModule[] = ["goals", "habits", "journal", "books", "tasks"];

interface ActionItem {
  label:  string;
  module: CommandModule;
  action: PendingAction;
  href:   string;
}

interface NavItem {
  label:  string;
  module: CommandModule;
  href:   string;
}

const ACTIONS: ActionItem[] = [
  { label: "New Goal",          module: "goals",   action: "new-goal",  href: "/life/goals" },
  { label: "New Habit",         module: "habits",  action: "new-habit", href: "/life/habits" },
  { label: "New Journal Entry", module: "journal", action: null,        href: "/life/journal" },
  { label: "Add Book",          module: "books",   action: "new-book",  href: "/life/books" },
];

const NAV_ITEMS: NavItem[] = [
  { label: "Goals",   module: "goals",   href: "/life/goals" },
  { label: "Habits",  module: "habits",  href: "/life/habits" },
  { label: "Journal", module: "journal", href: "/life/journal" },
  { label: "Books",   module: "books",   href: "/life/books" },
  { label: "Tasks",   module: "tasks",   href: "/pro/tasks" },
];

const TOTAL_QUICK_ITEMS = ACTIONS.length + NAV_ITEMS.length;

export function CommandCenter() {
  const { isOpen, close, setPendingAction } = useCommandCenter();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const showSearch = query.length >= 2;
  const { data: results = [], isLoading } = useCommandSearch(query);

  const grouped = useMemo(() => {
    const map = new Map<CommandModule, CommandResult[]>();
    for (const mod of MODULE_ORDER) {
      const items = results.filter((r) => r.module === mod);
      if (items.length > 0) map.set(mod, items);
    }
    return map;
  }, [results]);

  const totalItems = showSearch
    ? Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0)
    : TOTAL_QUICK_ITEMS;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => { setActiveIndex(0); }, [showSearch, results.length]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function navigate(href: string) {
    router.push(href);
    close();
  }

  function handleAction(href: string, action: PendingAction) {
    if (action) setPendingAction(action);
    navigate(href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (!showSearch) {
        if (activeIndex < ACTIONS.length) {
          const item = ACTIONS[activeIndex];
          if (item) handleAction(item.href, item.action);
        } else {
          const item = NAV_ITEMS[activeIndex - ACTIONS.length];
          if (item) navigate(item.href);
        }
      } else {
        let idx = 0;
        for (const items of grouped.values()) {
          for (const item of items) {
            if (idx === activeIndex) { navigate(item.href); return; }
            idx++;
          }
        }
      }
    } else if (e.key === "Escape") {
      close();
    }
  }

  let renderIdx = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={close}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4"
          >
            <div className="bg-[#111113] border border-white/8 rounded-2xl shadow-2xl overflow-hidden">

              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search anything..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <kbd className="text-[10px] text-zinc-600 bg-white/5 border border-white/8 rounded px-1.5 py-0.5">
                  Esc
                </kbd>
              </div>

              {/* Content */}
              <div className="max-h-90 overflow-y-auto py-2">
                {!showSearch ? (
                  <>
                    {/* Actions */}
                    <div className="px-4 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Actions</span>
                    </div>
                    {ACTIONS.map((item) => {
                      const idx = renderIdx++;
                      const cfg = MODULE_CONFIG[item.module];
                      return (
                        <button
                          type="button"
                          key={item.label}
                          ref={(el) => { itemRefs.current[idx] = el; }}
                          onClick={() => handleAction(item.href, item.action)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                            activeIndex === idx ? "bg-white/[0.07]" : "hover:bg-white/4"
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${cfg.color}20` }}
                          >
                            <Plus className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                          </div>
                          <span className="text-sm text-zinc-300">{item.label}</span>
                        </button>
                      );
                    })}

                    {/* Navigate */}
                    <div className="px-4 pt-3 pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Navigate</span>
                    </div>
                    {NAV_ITEMS.map((item) => {
                      const idx = renderIdx++;
                      const cfg = MODULE_CONFIG[item.module];
                      return (
                        <button
                          type="button"
                          key={item.href}
                          ref={(el) => { itemRefs.current[idx] = el; }}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                            activeIndex === idx ? "bg-white/[0.07]" : "hover:bg-white/4"
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${cfg.color}20` }}
                          >
                            <cfg.Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                          </div>
                          <span className="text-sm text-zinc-300">{item.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 ml-auto" />
                        </button>
                      );
                    })}
                  </>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  </div>
                ) : results.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <span className="text-sm text-zinc-500">No results for &ldquo;{query}&rdquo;</span>
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(([module, items]) => {
                    const cfg = MODULE_CONFIG[module];
                    return (
                      <div key={module}>
                        <div className="px-4 py-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        {items.map((item) => {
                          const idx = renderIdx++;
                          return (
                            <button
                              type="button"
                              key={item.id}
                              ref={(el) => { itemRefs.current[idx] = el; }}
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                                activeIndex === idx ? "bg-white/[0.07]" : "hover:bg-white/4"
                              }`}
                            >
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${cfg.color}20` }}
                              >
                                <cfg.Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm text-zinc-200 truncate">{item.title}</span>
                                {item.subtitle && (
                                  <span className="text-xs text-zinc-500 truncate">{item.subtitle}</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/8">
                <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                  <kbd className="bg-white/5 border border-white/8 rounded px-1 py-0.5">↑↓</kbd>
                  navigate
                </span>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                  <kbd className="bg-white/5 border border-white/8 rounded px-1 py-0.5">↵</kbd>
                  open
                </span>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                  <kbd className="bg-white/5 border border-white/8 rounded px-1 py-0.5">Esc</kbd>
                  close
                </span>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
