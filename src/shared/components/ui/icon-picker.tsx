"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search } from "lucide-react"
import { ICONS, DEFAULT_ICONS, resolveIcon } from "@/shared/constants/icons"
import { cn } from "@/shared/utils/utils"

interface IconPickerProps {
  value:       string | null | undefined
  onChange:    (key: string, color: string) => void
  accentColor?: string
}

export function IconPicker({ value, onChange, accentColor = "#f43f5e" }: IconPickerProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState("")
  const containerRef        = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  const selected     = resolveIcon(value)
  const SelectedIcon = selected.icon

  const filtered = search.trim()
    ? ICONS.filter((i) => {
        const q = search.toLowerCase()
        return i.label.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q))
      })
    : DEFAULT_ICONS.map((key) => ICONS.find((i) => i.key === key)).filter(Boolean) as typeof ICONS

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative w-full">

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg w-full",
          "bg-zinc-800/60 border border-zinc-700/60 text-zinc-200 text-sm",
          "hover:bg-zinc-800/80 transition-all",
          "focus:outline-none focus:ring-1 focus:ring-(--picker-accent)",
          open && "ring-1 ring-(--picker-accent)",
        )}
        style={{ "--picker-accent": accentColor } as React.CSSProperties}
      >
        <span
          className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
          style={{ backgroundColor: `${selected.color}18`, color: selected.color }}
        >
          <SelectedIcon size={13} />
        </span>
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <ChevronDown
          size={13}
          className={cn("text-zinc-500 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown — inline in DOM (no Portal), opens upward to avoid modal bottom clip */}
      {open && (
        <div className="absolute left-0 right-0 bottom-[calc(100%+4px)] z-50 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">

          {/* Search */}
          <div className="flex items-center border-b border-zinc-800 px-3">
            <Search size={13} className="mr-2 shrink-0 text-zinc-500" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              autoComplete="off"
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto overscroll-contain py-1
            [&::-webkit-scrollbar]:w-1
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-zinc-700">

            {filtered.length === 0 ? (
              <p className="py-5 text-center text-xs text-zinc-500">No icons found.</p>
            ) : (
              <div className="px-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {search.trim() ? "Results" : "Popular"}
                </p>
                {filtered.map((item) => {
                  const ItemIcon   = item.icon
                  const isSelected = item.key === selected.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onMouseDown={(e) => {
                        // Use mousedown so it fires before the outside-click closes the dropdown
                        e.preventDefault()
                        onChange(item.key, item.color)
                        setSearch("")
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition-colors",
                        "hover:bg-zinc-800 hover:text-zinc-100",
                        isSelected && "bg-zinc-800 text-zinc-100",
                      )}
                    >
                      <span
                        className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
                        style={{ backgroundColor: `${item.color}18`, color: item.color }}
                      >
                        <ItemIcon size={13} />
                      </span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isSelected && (
                        <span className="text-[10px] font-medium" style={{ color: accentColor }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
