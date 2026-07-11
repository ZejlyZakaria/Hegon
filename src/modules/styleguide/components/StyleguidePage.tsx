"use client";

import { useState } from "react";
import { ArrowLeft, Bookmark, Check, Heart, Plus, Search, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/utils/utils";

// Everything below is imported, never redrawn. If a primitive changes, this page changes
// with it — that's the whole point: it can't drift into a pretty lie.
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { CarouselNav } from "@/shared/components/ui/carousel-nav";
import { FilterSelect } from "@/shared/components/ui/filter-select";
import { SearchInput } from "@/shared/components/ui/search-input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { SlidingPanel } from "@/shared/components/ui/sliding-panel";
import { InlineFormActions } from "@/shared/components/ui/inline-form-actions";
import { Hint } from "@/shared/components/ui/tooltip";

// ── Token readers ─────────────────────────────────────────────────────────────
// The live value straight from the cascade. Written through a ref callback (runs at
// commit) so no value is ever hard-coded here — copy a hex into this file and it WILL
// go stale; read it and it can't.
const liveValue = (name: string) => (el: HTMLElement | null) => {
  if (el) el.textContent = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

function TokenRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {children}
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] text-text-secondary">{name}</p>
        <p ref={liveValue(name)} className="truncate font-mono text-[11px] text-text-tertiary" />
      </div>
    </div>
  );
}

function Swatch({ name }: { name: string }) {
  return (
    <TokenRow name={name}>
      <div
        className="h-10 w-10 shrink-0 rounded-control border border-border-subtle"
        style={{ background: `var(${name})` }}
      />
    </TokenRow>
  );
}

function RadiusSwatch({ name }: { name: string }) {
  return (
    <TokenRow name={name}>
      <div
        className="h-10 w-10 shrink-0 border border-border-strong bg-surface-2"
        style={{ borderRadius: `var(${name})` }}
      />
    </TokenRow>
  );
}

// ── Page scaffolding ──────────────────────────────────────────────────────────

function Block({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <SectionHeader title={title} subtitle={note} />
      <div className="surface-quiet rounded-card p-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle py-3 last:border-0">
      <span className="w-28 shrink-0 font-mono text-[11px] text-text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const SURFACES = ["--color-surface-0", "--color-surface-1", "--color-surface-2", "--color-surface-3"];
const TEXTS = ["--color-text-primary", "--color-text-secondary", "--color-text-tertiary", "--color-text-disabled"];
const BORDERS = ["--color-border-subtle", "--color-border-default", "--color-border-strong", "--color-border-focus"];
const ACCENTS = [
  "--color-accent-dashboard", "--color-accent-watching", "--color-accent-watching-vivid",
  "--color-accent-goals", "--color-accent-habits", "--color-accent-books",
  "--color-accent-journal", "--color-accent-tasks", "--color-accent-sports",
];
const RADII = ["--radius-chip", "--radius-control", "--radius-tile", "--radius-card", "--radius-modal"];
const TYPE = [
  { cls: "text-caption text-text-tertiary", name: "text-caption", use: "eyebrows, micro-labels" },
  { cls: "text-label text-text-secondary", name: "text-label", use: "metadata, chips, dates" },
  { cls: "text-body text-text-secondary", name: "text-body", use: "everyday reading size" },
  { cls: "text-title text-text-primary", name: "text-title", use: "section headings" },
];

const NAV = [
  ["foundations", "Foundations"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["controls", "Controls"],
  ["badges", "Badges"],
  ["feedback", "Overlays"],
  ["patterns", "Patterns"],
] as const;

const DEMO_ACCENT = { "--btn-accent": "var(--color-accent-watching)" } as React.CSSProperties;

export function StyleguidePage() {
  const [seg, setSeg] = useState<"all" | "films" | "series">("all");
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={13} />
          Settings
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Design system</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-tertiary">
          Every element below is the real component and the real token, imported live. Nothing here is
          a mockup — change a primitive and this page changes with it. If two things look different
          here, they look different in the app.
        </p>

        <nav className="mt-5 flex flex-wrap gap-1.5">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-control border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="space-y-10">
        {/* ── Foundations ── */}
        <Block id="foundations" title="Foundations" note="Surfaces, text, borders, module accents, radius roles — read live from the cascade">
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="mb-1 text-caption uppercase text-text-tertiary">Surfaces</p>
              {SURFACES.map((n) => <Swatch key={n} name={n} />)}
            </div>
            <div>
              <p className="mb-1 text-caption uppercase text-text-tertiary">Text</p>
              {TEXTS.map((n) => <Swatch key={n} name={n} />)}
            </div>
            <div>
              <p className="mb-1 text-caption uppercase text-text-tertiary">Borders</p>
              {BORDERS.map((n) => <Swatch key={n} name={n} />)}
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-caption uppercase text-text-tertiary">Module accents</p>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {ACCENTS.map((n) => <Swatch key={n} name={n} />)}
              </div>
            </div>
            <div>
              <p className="mb-1 text-caption uppercase text-text-tertiary">Radius by role</p>
              {RADII.map((n) => <RadiusSwatch key={n} name={n} />)}
            </div>
          </div>
        </Block>

        {/* ── Typography ── */}
        <Block id="type" title="Typography" note="Four tiers. A title is a title everywhere — that's what makes headings line up.">
          <div className="space-y-4">
            {TYPE.map((t) => (
              <div key={t.name} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-3 last:border-0">
                <span className={t.cls}>The quick brown fox jumps over the lazy dog</span>
                <span className="font-mono text-[11px] text-text-tertiary">
                  {t.name} — {t.use}
                </span>
              </div>
            ))}
          </div>
        </Block>

        {/* ── Buttons ── */}
        <Block id="buttons" title="Buttons" note="One component, four HEGON variants. quiet is the default control; glass sits on artwork; contrast and accent are CTAs.">
          <Row label="quiet">
            <Button variant="quiet" size="xs">xs</Button>
            <Button variant="quiet" size="sm">sm</Button>
            <Button variant="quiet">default</Button>
            <Button variant="quiet" size="lg">lg</Button>
          </Row>
          <Row label="subtle">
            <Button variant="subtle" size="sm">Bare action</Button>
            <Button variant="subtle" size="icon-sm" aria-label="Delete"><Trash2 /></Button>
          </Row>
          <Row label="contrast">
            <Button variant="contrast" size="sm">Selected</Button>
            <Button variant="contrast">Primary CTA</Button>
          </Row>
          <Row label="accent">
            <Button variant="accent" size="sm" style={DEMO_ACCENT}><Plus />Add</Button>
            <Button variant="accent" style={DEMO_ACCENT}>Module CTA</Button>
            <span className="font-mono text-[11px] text-text-tertiary">--btn-accent = the module colour</span>
          </Row>
          <Row label="glass">
            {/* Glass only makes sense over an image — so it's shown over one. */}
            <div className="flex items-center gap-2 rounded-card bg-linear-to-br from-zinc-600 to-zinc-900 p-3">
              <Button variant="glass" size="sm">Watch trailer</Button>
              <Button variant="glass" size="icon-sm" aria-label="Favorite"><Heart /></Button>
            </div>
          </Row>
          <Row label="icon sizes">
            <Button variant="quiet" size="icon-xs" aria-label="xs"><Star /></Button>
            <Button variant="quiet" size="icon-sm" aria-label="sm"><Star /></Button>
            <Button variant="quiet" size="icon" aria-label="md"><Star /></Button>
            <Button variant="quiet" size="icon-lg" aria-label="lg"><Star /></Button>
          </Row>
          <Row label="states">
            <Button variant="quiet" size="sm">Rest</Button>
            <Button variant="quiet" size="sm" disabled>Disabled</Button>
            <Button variant="accent" size="sm" style={DEMO_ACCENT} disabled><Check />Disabled CTA</Button>
          </Row>
        </Block>

        {/* ── Controls ── */}
        <Block id="controls" title="Controls" note="All 32px (sm) or 36px (default) tall — that is why two of them side by side line up.">
          <Row label="segmented">
            <SegmentedControl
              size="sm"
              value={seg}
              onChange={setSeg}
              items={[
                { value: "all", label: "All" },
                { value: "films", label: "Films" },
                { value: "series", label: "Series" },
              ]}
            />
            <CarouselNav size="md" onPrev={() => {}} onNext={() => {}} />
            <Button variant="quiet" size="sm">Same height</Button>
          </Row>
          <Row label="select">
            <FilterSelect
              size="sm"
              className="w-36"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Most recent" },
                { value: "rating", label: "Your rating" },
              ]}
              aria-label="Sort"
            />
            <FilterSelect
              className="w-36"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Most recent" },
                { value: "rating", label: "Your rating" },
              ]}
              aria-label="Sort"
            />
          </Row>
          <Row label="search">
            <SearchInput
              containerClassName="w-64"
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onClear={() => setQ("")}
            />
          </Row>
          <Row label="carousel nav">
            <CarouselNav size="sm" onPrev={() => {}} onNext={() => {}} />
            <CarouselNav size="md" onPrev={() => {}} onNext={() => {}} canPrev={false} />
            <span className="font-mono text-[11px] text-text-tertiary">sm · md · disabled edge</span>
          </Row>
          <Row label="inline form">
            <InlineFormActions
              accent="var(--color-accent-watching)"
              onCancel={() => {}}
              onSave={() => {}}
              saveLabel="Save"
            />
          </Row>
        </Block>

        {/* ── Badges ── */}
        <Block id="badges" title="Badges" note="The form is fixed; the colour carries the meaning.">
          <Row label="tint">
            <Badge color="var(--color-accent-watching-vivid)">Watching</Badge>
            <Badge color="#38bdf8">Paused</Badge>
            <Badge color="#fbbf24">Dropped</Badge>
            <Badge color="#8b5cf6">Want to watch</Badge>
          </Row>
          <Row label="solid">
            <Badge variant="solid" color="var(--color-accent-goals)">Done</Badge>
            <Badge variant="solid" color="#ef4444">Overdue</Badge>
          </Row>
          <Row label="outline">
            <Badge variant="outline" color="var(--color-accent-books)">Reading</Badge>
            <Badge variant="outline" uppercase color="var(--color-text-tertiary)">Draft</Badge>
          </Row>
        </Block>

        {/* ── Overlays ── */}
        <Block id="feedback" title="Overlays" note="Tooltip and sliding panel — the two surfaces that sit above the page.">
          <Row label="tooltip">
            <Hint label="This is the HEGON tooltip — not the OS one">
              <Button variant="quiet" size="sm">Hover me</Button>
            </Hint>
            <Hint label="Also works on icons" side="right">
              <Button variant="subtle" size="icon-sm" aria-label="Bookmark"><Bookmark /></Button>
            </Hint>
          </Row>
          <Row label="panel">
            <Button variant="quiet" size="sm" onClick={() => setPanel(true)}>Open sliding panel</Button>
          </Row>
        </Block>

        {/* ── Patterns ── */}
        <Block id="patterns" title="Patterns" note="Composites every screen reuses.">
          <div className="space-y-6">
            <div>
              <p className="mb-2 font-mono text-[11px] text-text-tertiary">SectionHeader — title + subtitle + toolbar</p>
              <div className="rounded-card border border-border-subtle p-4">
                <SectionHeader
                  title="Recently Watched"
                  subtitle="Your 10 most recently watched films"
                  actions={
                    <>
                      <CarouselNav onPrev={() => {}} onNext={() => {}} />
                      <Button variant="accent" size="sm" style={DEMO_ACCENT}><Plus />Add</Button>
                    </>
                  }
                />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-2/3 rounded-tile bg-surface-2" />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[11px] text-text-tertiary">Surfaces — the depth ladder</p>
              <div className="rounded-card bg-surface-1 p-4">
                <p className="mb-2 text-xs text-text-tertiary">surface-1 — page card</p>
                <div className="rounded-card bg-surface-2 p-4">
                  <p className="mb-2 text-xs text-text-tertiary">surface-2 — control / nested</p>
                  <div className="rounded-control bg-surface-3 p-3">
                    <p className="text-xs text-text-tertiary">surface-3 — popover / menu</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[11px] text-text-tertiary">Empty state</p>
              <div className={cn("flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle py-10")}>
                <Search size={18} className="text-text-tertiary" />
                <p className="text-sm text-text-secondary">Nothing here yet</p>
                <Button variant="quiet" size="sm"><Plus />Add the first one</Button>
              </div>
            </div>
          </div>
        </Block>
      </div>

      <SlidingPanel open={panel} onClose={() => setPanel(false)} title="Sliding panel">
        <div className="space-y-3 p-4">
          <p className="text-sm text-text-secondary">
            The shared right-side panel: spring in from the right, dim overlay, ESC or click-outside
            to close. Used by task detail, habit detail, goals, journal, book quotes, and the person
            timeline.
          </p>
          <Button variant="quiet" size="sm" onClick={() => setPanel(false)}>Close</Button>
        </div>
      </SlidingPanel>
    </div>
  );
}
