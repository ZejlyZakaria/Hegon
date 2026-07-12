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

// Adoption/debt, DERIVED FROM THE CODE by scripts/ds-coverage.mjs. A hand-kept map of "which
// module uses what" would be stale in a fortnight, and this page's only promise is that it
// cannot lie. Regenerate with `npm run ds:coverage`.
import coverageJson from "@/modules/styleguide/coverage.generated.json";

// TS would otherwise infer the literal shape of today's JSON (module names as keys, and so on),
// which breaks the moment a module is added. The generator's contract is what we type against.
type ModuleCoverage = {
  files: number;
  uses: string[];
  smells: Record<string, number>;
  worst: Record<string, { file: string; n: number }>;
};
type Coverage = {
  generatedAt: string;
  primitives: string[];
  smells: { key: string; label: string; fix: string }[];
  modules: Record<string, ModuleCoverage>;
  adoption: Record<string, string[]>;
};
const coverage = coverageJson as Coverage;

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
const POSTERS: { name: string; use: string }[] = [
  { name: "--poster-xs", use: "attribution, Top Picks, timeline rows" },
  { name: "--poster-sm", use: "info rows (Books)" },
  { name: "--poster-md", use: "rail tile — mobile · hero poster — mobile" },
  { name: "--poster-lg", use: "rail tile — desktop" },
  { name: "--poster-xl", use: "hero poster — desktop" },
];
const TYPE = [
  { cls: "text-caption text-text-tertiary", name: "text-caption", use: "eyebrows, micro-labels" },
  { cls: "text-label text-text-secondary", name: "text-label", use: "metadata, chips, dates" },
  { cls: "text-body text-text-secondary", name: "text-body", use: "everyday reading size" },
  { cls: "text-title text-text-primary", name: "text-title", use: "section headings" },
];

// THE FOUR POSTER CARDS. Written down because "what goes on a poster" was being re-decided
// on every screen, and six screens gave six answers. The rule that generates all four: a card
// shows what ITS SCREEN is for, and nothing else. The library is a catalogue → it needs the
// facts. Watch History is a log → it needs when and how good. More Like This is a shelf you
// haven't touched → it needs nothing but the invitation to take one.
const POSTER_CARDS: { name: string; where: string; slots: [string, string][] }[] = [
  {
    name: "Library card",
    where: "the catalogue — you own it, so you can act on it",
    slots: [
      ["top left", "favorite (heart) — IDENTITY cluster"],
      ["top right", "the ⋯ menu, on hover — ACTIONS cluster"],
      ["bottom", "status badge (glass), on the scrim"],
      ["under it", "title · year + your score"],
    ],
  },
  {
    name: "Watch History card",
    where: "a log of seasons — when, and how good",
    slots: [
      ["top left", "the year (glass)"],
      ["top right", '"Now" (glass) — the season you\'re on'],
      ["bottom mask", "S{n} + your score, in the accent"],
      ["under it", "nothing — the card says it all"],
    ],
  },
  {
    name: "More Like This card",
    where: "a shelf you don't own yet",
    slots: [
      ["on the artwork", "nothing at all"],
      ["on hover", "one + circle — the only gesture available"],
      ["under it", "title"],
      ["why", "you have no history with it: there is nothing true to show"],
    ],
  },
  {
    name: "Person tile",
    where: "their filmography, six to a row",
    slots: [
      ["on the artwork", "status badge only — it stays where it is"],
      ["title line", "title, and your score right-aligned"],
      ["under it", "the role they played"],
      ["why", "at this size a corner mark fights the badge and loses"],
    ],
  },
];

// ── The rules ────────────────────────────────────────────────────────────────────────────
// Not component docs — the cross-cutting decisions. Each one was re-argued on three separate
// screens before it got written here, which is the whole reason it's written here.
const RULES: { title: string; body: string; code?: string }[] = [
  {
    title: "The overlay grammar — two clusters, and nothing else",
    body:
      "On a piece of artwork, exactly two clusters may exist: LEFT = identity (what the title is — rank, priority), RIGHT = actions (what you can do to it — favorite, menu). Same inset, same 24px item height, same gap, so they align BY CONSTRUCTION. Before this, a rank sat at top-3 left-3, a heart at top-3 right-10 and a menu at top-2 right-2 — three independent guesses, and nothing ever lined up.",
    code: "OVERLAY_CLUSTER = \"absolute top-2.5 z-10 flex h-6 items-center gap-1.5\"\n  left-2.5  → identity\n  right-2.5 → actions",
  },
  {
    title: "Nested radius: inner = outer − padding",
    body:
      "Two rounded boxes, one inside the other, only nest correctly if the inner radius is the outer radius minus the padding between them. Get it wrong and the inner corner bulges past the outer one — it reads as a mistake even when nobody can say why. The hero poster had rounded-tile (8) + p-1 (4) + an inner rounded-[10px]: the inside was ROUNDER than the outside.",
    code: "rounded-card (12) + p-1 (4) → inner must be rounded-tile (8)",
  },
  {
    title: "⚠ tailwind-merge silently deletes custom tokens",
    body:
      "cn() runs tailwind-merge, which only knows Tailwind's OWN class groups. A custom token like text-caption or rounded-chip is unknown to it, so when it sits next to something merge thinks conflicts, it is DROPPED — no error, no warning, the class simply never reaches the DOM and the element falls back to inherited 16px. Every new scale token must be declared in extendTailwindMerge or it is a ghost. This cost a full debugging session.",
    code: "// shared/utils/utils.ts\nextendTailwindMerge({ extend: { classGroups: {\n  \"font-size\": [{ text: [\"caption\",\"micro\",\"label\",\"body\",\"title\"] }],\n  rounded:     [{ rounded: [\"chip\",\"control\",\"tile\",\"card\",\"modal\"] }],\n}}})",
  },
  {
    title: "⚠ Never hand-write -webkit-backdrop-filter",
    body:
      "Lightning CSS (Tailwind v4's compiler) adds vendor prefixes itself. If it finds a -webkit- line already written, it DEDUPES: it keeps the prefixed one and drops the standard property. Current Chrome no longer honours the -webkit- alias, so the CSS compiles clean, ships, and blurs nothing. Every glass utility in the app sat like that for months — the dock, the widgets, every chip. Write the standard property alone.",
    code: "backdrop-filter: blur(10px) saturate(240%);   /* ✓ prefix is added for you */",
  },
  {
    title: "Fix the primitive, not the screen",
    body:
      "Every symptom in this module traced back to a missing or bypassed primitive. The List Detail toolbar looked 'off' — the cause was a SearchInput with no size prop, sitting at 36px beside 32px buttons. Two rails 'didn't match' — the cause was one bleeding out of the column gutter and the other not. If a screen needs a local fix, the primitive is incomplete: fix it there, once.",
  },
  {
    title: "Cursor: pointer is not free",
    body:
      "Tailwind v4 removed cursor:pointer from its reset. Restored once, globally, in globals.css — not per button, forever.",
    code: "button:not(:disabled), [role=\"button\"]:not([aria-disabled=\"true\"]), summary { cursor: pointer }",
  },
  {
    title: "A scrolling row needs vertical headroom",
    body:
      "overflow-x: auto forces overflow-y to clip. A rail whose cards scale on hover will have them cut off at the top and bottom unless the container carries py-* padding. Every rail here uses py-1.5 for exactly that reason.",
  },
];

// ── The anti-patterns ────────────────────────────────────────────────────────────────────
const ANTI_PATTERNS: { tried: string; why: string }[] = [
  {
    tried: "Dark translucent fill as 'glass'",
    why:
      "rgba(0,0,0,0.55) darkens by a FIXED amount, so it's invisible on a black poster and still blinding on a white one. It hides the artwork instead of taking its colour. Glass has to TRANSFORM what's under it (blur + saturate + a luminance clamp), not sit on top of it.",
  },
  {
    tried: "Coloured text on glass",
    why:
      "Glass takes its brightness from the poster, so teal text survives a dark one and dies on a bright one. The fix everyone reaches for — darken the material until the text works — kills the glass. The label goes WHITE and the colour moves to the dot. You don't dim the window to read the sticker.",
  },
  {
    tried: "The Top-10 rank in a grey disc",
    why:
      "A disc says nothing and reads as a bug at poster scale. Then a fat teal numeral: loud, and it fought the artwork. Both treated the rank as an OBJECT to place. It's a masthead — a small tight numeral plus a hairline accent rule.",
  },
  {
    tried: "Boxing a score in a badge",
    why:
      "A number doesn't need a container, it needs a colour. In a box it competes with the flags (New, Trending), which are the only things on a card entitled to shout.",
  },
  {
    tried: "One badge per fact on a poster",
    why:
      "'Watching' + 'S3 · E7' on a 100px-wide tile: neither had room, and the position lost — half of them rendered as a truncated 'S3 · '. A poster says WHERE a title stands, not how far in you are.",
  },
  {
    tried: "Decorative top accent hairlines on cards",
    why:
      "A coloured 1px gradient across the top of every card. Owner rejected it outright: depth comes from the surface ladder and hover scale, not from stripes.",
  },
  {
    tried: "Wrapping every section in a card",
    why:
      "Tried on the detail page: a title and its content boxed together. It doesn't give a section presence — COLOUR does. Anything that can scroll horizontally must not be boxed at all, or it can't bleed to the screen edge.",
  },
  {
    tried: "Radix Select as an inline picker",
    why:
      "It applies aria-hidden to the page behind it and breaks scroll inside a Dialog. Use a Popover with an inline dropdown.",
  },
];

// ── The gaps ─────────────────────────────────────────────────────────────────────────────
const GAPS: string[] = [
  "Radius on glass: the badge stays rounded-chip because 'a pill is only for shapes that ARE round' is a locked rule — but the iOS reference is a capsule, and for a pane of glass that defends itself. Unresolved, deliberately.",
  "text-[13px] (7×, the hero Back buttons) and text-[9px] (6×, micro-badges) still sit outside the type scale. Either they become tokens or they become text-micro; nobody has decided.",
  "The 'off-system hits' counter below is a proxy, not a verdict: some bg-black/xx are legitimate scrims, not hand-rolled chips. It over-counts on purpose — a number that flatters you is useless.",
  "Seven modules are still un-propagated. Books first (closest to Watching), Tasks last (most atypical). Sports carries the most debt by far.",
  "The motion language (springs, durations, easings) is not in this page yet. It lives in shared/ui/motion.tsx and in the dashboard's engine, undocumented.",
  "No light theme exists and none is planned — every material here assumes a dark surface underneath.",
];

const MODULE_OPTIONS = [
  { value: "all", label: "All modules" },
  ...Object.keys(coverage.modules)
    .sort()
    .map((m) => ({ value: m, label: m })),
];

const NAV = [
  ["foundations", "Foundations"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["controls", "Controls"],
  ["badges", "Badges"],
  ["cards", "Poster cards"],
  ["feedback", "Overlays"],
  ["patterns", "Patterns"],
  ["rules", "Rules"],
  ["antipatterns", "Anti-patterns"],
  ["coverage", "Coverage"],
  ["gaps", "Known gaps"],
] as const;

const DEMO_ACCENT = { "--btn-accent": "var(--color-accent-watching)" } as React.CSSProperties;

export function StyleguidePage() {
  const [seg, setSeg] = useState<"all" | "films" | "series">("all");
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState(false);
  const [mod, setMod] = useState<string>("all");

  // Debt = every place a module answered a question the system already answers.
  const debtOf = (m: { smells: Record<string, number> }) =>
    Object.values(m.smells).reduce((a, b) => a + b, 0);
  const debtRanked = Object.entries(coverage.modules)
    .map(([name, m]) => [name, m, debtOf(m)] as const)
    .sort((a, b) => b[2] - a[2]);
  const maxDebt = debtRanked[0]?.[2] ?? 0;
  const totalDebt = debtRanked.reduce((a, [, , n]) => a + n, 0);

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

          {/* Posters — one ratio, five widths. Shown at true size, side by side: two rails
              that don't match are impossible to miss here (that's how the 144 vs 112 mobile
              mismatch was found). */}
          <div className="mt-6 border-t border-border-subtle pt-5">
            <p className="mb-1 text-caption uppercase text-text-tertiary">Poster scale</p>
            <p className="mb-2 text-xs leading-relaxed text-text-tertiary">
              One ratio (2:3), five widths — height always follows, so a cover is never cropped.
              A poster&apos;s width comes from its <span className="text-text-secondary">container</span>, and there
              are exactly three containers:
            </p>
            <ul className="mb-4 space-y-1 text-xs leading-relaxed text-text-tertiary">
              <li>
                <span className="font-medium text-text-secondary">Grid</span> → fluid. The grid decides
                (Library, person pages, More Like This on desktop).
              </li>
              <li>
                <span className="font-medium text-text-secondary">Full-width carousel</span> (home sections) →
                a fraction of the page: N cards per view, ~2.4 peeking on a phone.
              </li>
              <li>
                <span className="font-medium text-text-secondary">In-column rail</span> (detail page) →{" "}
                <code className="font-mono text-[11px]">--rail-peek</code> on a phone (3.4 cards, so the 4th is
                cut and says &quot;this scrolls&quot;), <code className="font-mono text-[11px]">--poster-lg</code> on
                desktop. Two rails in the same column then match by construction — a fixed 144 vs 112 never could.
              </li>
            </ul>
            <div className="flex flex-wrap items-end gap-5">
              {POSTERS.map((p) => (
                <div key={p.name} className="min-w-0">
                  <div
                    className="aspect-2/3 rounded-tile bg-linear-to-br from-surface-2 to-surface-3 ring-1 ring-border-subtle"
                    style={{ width: `var(${p.name})` }}
                  />
                  <p className="mt-2 font-mono text-[11px] text-text-secondary">{p.name}</p>
                  <p ref={liveValue(p.name)} className="font-mono text-[11px] text-text-tertiary" />
                  <p className="mt-0.5 max-w-40 text-[11px] leading-snug text-text-tertiary">{p.use}</p>
                </div>
              ))}
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
        <Block id="buttons" title="Buttons" note="One component. quiet is THE DEFAULT; overlay sits on artwork; contrast and accent are CTAs. legacy is shadcn — every use of it is a call site awaiting review.">
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
          <Row label="overlay">
            {/* Glass only makes sense over an image — so it's shown over one. */}
            <div className="flex items-center gap-2 rounded-card bg-linear-to-br from-zinc-600 to-zinc-900 p-3">
              <Button variant="overlay" size="sm">Watch trailer</Button>
              <Button variant="overlay" size="icon-sm" aria-label="Favorite"><Heart /></Button>
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
        <Block
          id="badges"
          title="Badges"
          note="The form is fixed; the colour carries the meaning. The MATERIAL is chosen by the surface underneath — never by taste."
        >
          <Row label="tint">
            <Badge color="var(--color-accent-watching-vivid)">Watching</Badge>
            <Badge color="#38bdf8">Paused</Badge>
            <Badge color="#fbbf24">Dropped</Badge>
            <Badge color="#8b5cf6">Want to watch</Badge>
          </Row>
          <Row label="sizes">
            <Badge size="sm" color="var(--color-accent-watching-vivid)">sm — poster corners</Badge>
            <Badge size="md" color="var(--color-accent-watching-vivid)">md — default</Badge>
            <Badge size="lg" color="var(--color-accent-watching-vivid)">lg — hero chips</Badge>
          </Row>

          {/* THE rule of the module, shown on artwork because that's the only place it applies. */}
          <Row label="on artwork">
            <div className="flex items-center gap-2 rounded-tile bg-linear-to-br from-amber-200 via-rose-400 to-zinc-800 p-3">
              <Badge variant="flag" size="sm" uppercase color="var(--color-accent-watching-vivid)">New</Badge>
              <Badge variant="flag" size="sm" uppercase color="#fb7185">High</Badge>
              <Badge variant="overlay" size="sm" color="rgba(255,255,255,0.8)">Thriller</Badge>
              <span className="inline-flex items-center gap-1 text-micro font-semibold tabular-nums" style={{ color: "var(--color-gold)" }}>
                <Star size={10} style={{ color: "var(--color-gold)", fill: "var(--color-gold)" }} />
                8.4
              </span>
            </div>
            <ul className="space-y-1 text-micro leading-relaxed text-text-tertiary">
              <li><span className="font-medium text-text-secondary">glass</span> = a FLAG — something ADDED to the title (New, Priority, Trending, Status). Semibold: it shouts.</li>
              <li><span className="font-medium text-text-secondary">overlay</span> = METADATA — what the title IS (its genres). Medium: it whispers.</li>
              <li><span className="font-medium text-text-secondary">no container</span> = a NUMBER (year, score). Colour carries it; a box would make it shout.</li>
            </ul>
          </Row>

          <Row label="the glass">
            <div
              className="flex items-center gap-2 rounded-tile p-3"
              style={{ backgroundImage: "linear-gradient(115deg,#f8fafc 0%,#38bdf8 32%,#f43f5e 62%,#18181b 100%)" }}
            >
              <Badge variant="flag" size="md" uppercase color="var(--color-accent-watching-vivid)">Trending</Badge>
              <Badge variant="flag" size="md" dot color="#7dd3fc">Paused</Badge>
              <span className="glass-thin flex h-6 w-6 items-center justify-center rounded-full">
                <Heart size={12} style={{ color: "#f43f5e", fill: "#f43f5e" }} />
              </span>
            </div>
            <ul className="max-w-md space-y-1 text-micro leading-relaxed text-text-tertiary">
              <li>
                <span className="font-medium text-text-secondary">It shows what&apos;s under it.</span>{" "}
                Moderate blur (10px — at 24 the poster dissolves into grey mush) and a heavy saturation
                push, so the hue survives the darkening.
              </li>
              <li>
                <span className="font-medium text-text-secondary">The edge IS the effect.</span> A
                specular top bevel, the light bouncing back underneath, a bright hairline round the
                whole rim, and an inner glow raking down — that glow is the pane&apos;s thickness. One
                flat hairline reads as a rectangle with a blur behind it.
              </li>
              <li>
                <span className="font-medium text-text-secondary">The label is WHITE.</span> Glass takes
                its brightness from the poster, so coloured text dies on a bright one. The colour moves
                to the dot (or the icon). Dimming the material until teal text survives is how you kill
                the glass — you don&apos;t dim the window to read the sticker.
              </li>
            </ul>
          </Row>

          <Row label="the marks">
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: "var(--color-gold)" }}>
              <Star size={11} style={{ color: "var(--color-gold)", fill: "var(--color-gold)" }} /> 8.4
            </span>
            <span className="font-mono text-micro text-text-tertiary">gold = the WORLD&apos;s score (TMDB/IMDb)</span>
            <span className="ml-4 inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: "var(--color-accent-watching-vivid)" }}>
              <Star size={11} style={{ color: "var(--color-accent-watching-vivid)", fill: "var(--color-accent-watching-vivid)" }} /> 9
            </span>
            <span className="font-mono text-micro text-text-tertiary">teal = YOURS</span>
            <Heart size={13} className="ml-4" style={{ color: "#f43f5e", fill: "#f43f5e" }} />
            <span className="font-mono text-micro text-text-tertiary">red = affection (the one non-system colour)</span>
          </Row>

          <Row label="the rank">
            <span className="flex h-6 items-center gap-1.5 rounded-tile bg-linear-to-br from-zinc-700 to-zinc-900 px-2">
              <span
                className="h-4.5 w-[2.5px] rounded-full"
                style={{
                  backgroundColor: "var(--color-accent-watching-vivid)",
                  boxShadow: "0 0 8px var(--color-accent-watching-vivid)",
                }}
              />
              <span className="text-sm font-bold leading-none tabular-nums tracking-tight text-white">01</span>
            </span>
            <p className="max-w-md text-micro leading-relaxed text-text-tertiary">
              A rank is a masthead, not a badge. Small numeral, set tight, in white; the accent is a
              hairline rule beside it — the same gesture as a section label. Zero-padded so #1 and #10
              are the same width and a ranked rail lines up down its left edge.
            </p>
          </Row>

          <Row label="radius">
            <span className="font-mono text-micro text-text-tertiary">
              rounded-full is for shapes that ARE round (circles, dots, avatars). Anything carrying
              TEXT takes a radius token — a badge is rounded-chip, never a pill.
            </span>
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

        {/* ── Poster cards ── */}
        <Block
          id="cards"
          title="Poster cards"
          note="Four anatomies, and only four. A poster is not a place to put everything you know about a title — it's a place to put the ONE thing that screen is about."
        >
          <div className="space-y-4">
            {POSTER_CARDS.map((c) => (
              <div key={c.name} className="border-b border-border-subtle pb-4 last:border-0 last:pb-0">
                <p className="font-mono text-[11px] text-text-secondary">{c.name}</p>
                <p className="mt-0.5 text-micro text-text-tertiary">{c.where}</p>
                <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {c.slots.map(([slot, what]) => (
                    <div key={slot} className="flex gap-2 text-micro">
                      <span className="w-24 shrink-0 font-mono text-text-tertiary">{slot}</span>
                      <span className="min-w-0 text-text-secondary">{what}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-micro leading-relaxed text-text-tertiary">
              What the four have in common: the ARTWORK never carries a number twice, a score is
              always the ScoreMark (gold = the world, teal = you), a flag is always glass, and
              anything written UNDER the poster is on a page surface — so it wears no material at
              all.
            </p>
          </div>
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

        {/* ── Rules ── */}
        <Block
          id="rules"
          title="Rules"
          note="The decisions that aren't visible in any single component — the ones that get re-litigated on every screen until they're written down."
        >
          <div className="space-y-4">
            {RULES.map((r) => (
              <div key={r.title} className="border-b border-border-subtle pb-4 last:border-0 last:pb-0">
                <p className="text-xs font-semibold text-text-primary">{r.title}</p>
                <p className="mt-1 text-micro leading-relaxed text-text-tertiary">{r.body}</p>
                {r.code && (
                  <pre className="mt-2 overflow-x-auto rounded-control bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
                    {r.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Block>

        {/* ── Anti-patterns ── */}
        <Block
          id="antipatterns"
          title="Anti-patterns"
          note="What was tried and why it failed. A system that only says what to do gets worked around; one that says what didn't work holds."
        >
          <div className="space-y-3">
            {ANTI_PATTERNS.map((a) => (
              <div key={a.tried} className="grid gap-1 border-b border-border-subtle pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_1.4fr] sm:gap-4">
                <p className="text-xs font-medium text-rose-300/80">✗ {a.tried}</p>
                <p className="text-micro leading-relaxed text-text-tertiary">{a.why}</p>
              </div>
            ))}
          </div>
        </Block>

        {/* ── Coverage ── */}
        <Block
          id="coverage"
          title="Coverage"
          note={`Generated from the code by scripts/ds-coverage.mjs on ${coverage.generatedAt} — never hand-written, so it can't flatter us. It counts what each module IMPORTS from the system, and what it still hand-rolls.`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FilterSelect
              size="sm"
              className="w-44"
              value={mod}
              onChange={setMod}
              options={MODULE_OPTIONS}
              aria-label="Filter by module"
            />
            <p className="text-micro text-text-tertiary">
              <span className="font-semibold text-text-secondary">{totalDebt}</span> off-system hits across{" "}
              {Object.keys(coverage.modules).length} modules
            </p>
          </div>

          {mod === "all" ? (
            <>
              {/* Adoption — which primitives nobody has picked up. The gaps are the point. */}
              <p className="mb-2 text-caption uppercase text-text-tertiary">Adoption</p>
              <div className="mb-6 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {coverage.primitives.map((p) => {
                  const users = coverage.adoption[p] ?? [];
                  return (
                    <div key={p} className="flex items-baseline gap-2 text-micro">
                      <span className="w-36 shrink-0 truncate font-mono text-text-secondary">{p}</span>
                      {users.length === 0 ? (
                        <span className="text-rose-300/70">nobody</span>
                      ) : (
                        <span className="min-w-0 truncate text-text-tertiary">
                          <span className="font-semibold text-text-secondary">{users.length}</span>{" "}
                          · {users.join(", ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Debt — worst first. This is the propagation order, and it isn't an opinion. */}
              <p className="mb-2 text-caption uppercase text-text-tertiary">Debt, worst first</p>
              <div className="space-y-1">
                {debtRanked.map(([name, m, hits]) => (
                  <div key={name} className="flex items-center gap-3 text-micro">
                    <span className="w-28 shrink-0 font-mono text-text-secondary">{name}</span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-rose-400/60"
                        style={{ width: `${maxDebt ? (hits / maxDebt) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right tabular-nums text-text-tertiary">{hits}</span>
                    <span className="w-20 shrink-0 text-right tabular-nums text-text-tertiary">
                      {m.uses.length} used
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-caption uppercase text-text-tertiary">Uses</p>
                <div className="flex flex-wrap gap-1.5">
                  {(coverage.modules[mod]?.uses ?? []).map((p) => (
                    <Badge key={p} size="sm" color="var(--color-accent-goals)">{p}</Badge>
                  ))}
                  {(coverage.modules[mod]?.uses ?? []).length === 0 && (
                    <p className="text-micro text-text-tertiary">Nothing from the system at all.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-caption uppercase text-text-tertiary">Not adopted yet</p>
                <div className="flex flex-wrap gap-1.5">
                  {coverage.primitives
                    .filter((p) => !(coverage.modules[mod]?.uses ?? []).includes(p))
                    .map((p) => (
                      <Badge key={p} variant="outline" size="sm" color="var(--color-text-tertiary)">{p}</Badge>
                    ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-caption uppercase text-text-tertiary">Still hand-rolled</p>
                {Object.keys(coverage.modules[mod]?.smells ?? {}).length === 0 ? (
                  <p className="text-micro text-text-tertiary">Nothing. This module is on the system.</p>
                ) : (
                  <div className="space-y-2">
                    {coverage.smells
                      .filter((s) => coverage.modules[mod]?.smells?.[s.key])
                      .map((s) => {
                        const n = coverage.modules[mod].smells[s.key];
                        const worst = coverage.modules[mod].worst?.[s.key];
                        return (
                          <div key={s.key} className="text-micro">
                            <p className="text-text-secondary">
                              <span className="font-semibold tabular-nums text-rose-300/80">{n}×</span> {s.label}
                              <span className="text-text-tertiary"> — {s.fix}</span>
                            </p>
                            {worst && (
                              <p className="mt-0.5 truncate font-mono text-[11px] text-text-tertiary">
                                worst: {worst.file} ({worst.n})
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Block>

        {/* ── Known gaps ── */}
        <Block
          id="gaps"
          title="Known gaps"
          note="Open, on purpose. A design system that claims to be finished is lying."
        >
          <ul className="space-y-2">
            {GAPS.map((g) => (
              <li key={g} className="flex gap-2 text-micro leading-relaxed text-text-tertiary">
                <span className="text-text-disabled">·</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
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
