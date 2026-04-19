"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search } from "lucide-react"
import { ICONS, DEFAULT_ICONS, resolveIcon } from "@/shared/constants/icons"
import { cn } from "@/shared/utils/utils"

interface IconPickerProps {
  value: string | null | undefined
  onChange: (key: string, color: string) => void
  accentColor?: string
}

export function IconPicker({ value, onChange, accentColor = "#f43f5e" }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = resolveIcon(value)
  const SelectedIcon = selected.icon

  const filtered = search.trim()
    ? ICONS.filter((i) => {
        const q = search.toLowerCase()
        return i.label.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q))
      })
    : (DEFAULT_ICONS
        .map((key) => ICONS.find((i) => i.key === key))
        .filter(Boolean) as typeof ICONS)

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

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 h-8 rounded-md border px-3 text-sm",
          "bg-[#1f1f22] border-white/[0.07] text-[#e2e2e6]",
          "focus:outline-none focus:border-white/20",
          open && "border-white/20"
        )}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${selected.color}18`, color: selected.color }}
        >
          <SelectedIcon size={13} />
        </span>

        <span className="flex-1 truncate text-left">{selected.label}</span>

        <ChevronDown
          size={13}
          className={cn(
            "shrink-0 text-[#71717a] transition-transform duration-100",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+4px)] left-0 right-0 z-50 rounded-lg border border-white/11 bg-[#1a1a1d] shadow-xl">
          <div className="flex items-center border-b border-white/[0.07] px-3">
            <Search size={13} className="mr-2 shrink-0 text-[#71717a]" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full bg-transparent text-sm text-[#e2e2e6] outline-none placeholder:text-[#71717a]"
              autoComplete="off"
            />
          </div>

          <div className="max-h-52 overflow-y-auto overscroll-contain py-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#71717a]">No icons found.</p>
            ) : (
              <div className="px-1">
                <p className="px-2 py-1 text-[10px] font-medium text-[#71717a]">
                  {search.trim() ? "Results" : "Popular"}
                </p>

                {filtered.map((item) => {
                  const ItemIcon = item.icon
                  const isSelected = item.key === selected.key

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(item.key, item.color)
                        setSearch("")
                        setOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-100",
                        isSelected
                          ? "bg-[#141416] text-[#e2e2e6]"
                          : "text-[#a0a0a8] hover:bg-[#141416] hover:text-[#e2e2e6]"
                      )}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${item.color}18`, color: item.color }}
                      >
                        <ItemIcon size={13} />
                      </span>

                      <span className="flex-1 text-left">{item.label}</span>

                      {isSelected && (
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: accentColor }}
                        >
                          ✓
                        </span>
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
