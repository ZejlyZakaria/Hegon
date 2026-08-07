"use client";

// Compact per-section filter: a select sitting next to a section title. Opening it reveals a search
// on top + the followed teams (crest + name) — saves the space a chip row would eat. Value is a team's
// api_external_id, or "all".

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Search, Check, X } from "lucide-react";

export interface SelectTeam {
  id: string; // api_external_id
  name: string;
  crest: string | null;
  isMain?: boolean;
}

const CREST_FALLBACK = "/placeholder-logo.svg";

export default function SectionTeamSelect({
  teams,
  value,
  onChange,
  allLabel = "All teams",
  searchPlaceholder = "Search team…",
  includeAll = true,
}: {
  teams: SelectTeam[];
  value: string; // "all" | api_external_id (or an id when includeAll is false)
  onChange: (v: string) => void;
  allLabel?: string;
  searchPlaceholder?: string;
  includeAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const current = value === "all" ? null : teams.find((t) => t.id === value) ?? null;
  const filtered = q.trim()
    ? teams.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()))
    : teams;

  const close = () => { setOpen(false); setQ(""); };
  const pick = (id: string) => { onChange(id); close(); };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-control border border-border-subtle bg-surface-2 pl-2 pr-2 text-xs font-semibold text-text-secondary transition-colors hover:border-border-default hover:text-text-primary"
      >
        {current ? (
          <>
            <Crest src={current.crest} alt={current.name} />
            <span className="max-w-32 truncate">{current.name}</span>
          </>
        ) : (
          <span>{allLabel}</span>
        )}
        <ChevronDown size={13} className="text-text-tertiary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute right-0 top-9 z-30 w-56 overflow-hidden rounded-control border border-border-strong bg-surface-2 shadow-xl shadow-black/40">
            {/* search */}
            <div className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-2">
              <Search size={13} className="shrink-0 text-text-tertiary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="text-text-tertiary hover:text-text-secondary">
                  <X size={12} />
                </button>
              )}
            </div>
            {/* list */}
            <div className="max-h-64 overflow-y-auto py-1">
              {includeAll && !q && (
                <Row active={value === "all"} onClick={() => pick("all")}>
                  <span className="text-sm text-text-primary">{allLabel}</span>
                </Row>
              )}
              {filtered.map((t) => (
                <Row key={t.id} active={value === t.id} onClick={() => pick(t.id)}>
                  <Crest src={t.crest} alt={t.name} />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{t.name}</span>
                  {t.isMain && <span className="text-[10px] text-accent-sports">★</span>}
                </Row>
              ))}
              {q && filtered.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-text-tertiary">No team</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/5"
    >
      {children}
      {active && <Check size={14} className="shrink-0 text-accent-sports" />}
    </button>
  );
}

function Crest({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative h-5 w-5 shrink-0">
      <Image src={src || CREST_FALLBACK} alt={alt} fill sizes="20px" className="object-contain" />
    </span>
  );
}
