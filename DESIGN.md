---
name: HEGON
description: A personal OS for one person — centralized, module-identified, fluid by design.
colors:
  # ── Surfaces (5 depth stops) ────────────────────────────────────────────────
  surface-base:     "#09090b"
  surface-raised:   "#0e0e10"
  surface-elevated: "#141416"
  surface-overlay:  "#1a1a1d"
  surface-input:    "#1f1f22"
  # ── Ink scale ───────────────────────────────────────────────────────────────
  ink-primary:   "#e2e2e6"
  ink-secondary: "#a0a0a8"
  ink-tertiary:  "#71717a"
  ink-disabled:  "#3d3d44"
  # ── Borders (white-alpha) ────────────────────────────────────────────────────
  border-subtle:  "#ffffff0a"
  border-default: "#ffffff12"
  border-strong:  "#ffffff1c"
  border-focus:   "#ffffff33"
  # ── Module accents (one per module — Identity per module) ────────────────────
  accent-dashboard:      "#60a5fa"
  accent-goals:          "#22c55e"
  accent-habits:         "#f43f5e"
  accent-journal:        "#f97316"
  accent-tasks:          "#71717a"
  accent-watching:       "#0c3d4a"
  accent-watching-vivid: "#2dd4bf"
  accent-sports:         "#10b981"
  accent-books:          "#0ea5e9"
  # ── Semantic ────────────────────────────────────────────────────────────────
  semantic-error:   "#f87171"
  semantic-warning: "#f59e0b"
  semantic-success: "#4ade80"
typography:
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm:   "4px"
  md:   "6px"
  lg:   "8px"
  xl:   "12px"
  full: "9999px"
spacing:
  xs:  "4px"
  sm:  "8px"
  md:  "12px"
  lg:  "16px"
  xl:  "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-watching}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-watching}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-tertiary}"
    rounded: "{rounded.full}"
    padding: "8px"
  button-ghost-hover:
    backgroundColor: "{colors.border-subtle}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.full}"
    padding: "8px"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "12px"
  card-hover:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-tertiary}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "rgba(255,255,255,0.07)"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
---

# Design System: HEGON

## 1. Overview

**Creative North Star: "The Personal OS"**

HEGON is a system of operating that belongs to exactly one person. Not a dashboard, not a SaaS tool — a personal OS built to the standard Zakaria holds every piece of software to: Apple's. The interface should feel like opening System Preferences and finding your entire life organized in it. Each module is a panel in that OS, with its own color, its own soul, and its own rules. The whole is coherent; the parts are distinct.

The visual language is rooted in depth, not darkness. Five surface stops (#09090b → #0e0e10 → #141416 → #1a1a1d → #1f1f22) create the illusion of a layered OS stack. Nothing is flat. The eye always knows where it is in the hierarchy. Motion is short and decisive: state changes in 150ms, entrances in 250ms. Nothing choreographs; everything responds.

Module identity is the defining trait of the system. Each section owns an accent color — dashboard gets Control Blue (#60a5fa), goals get Emerald Drive (#22c55e), watching gets Cinema Depth (#0c3d4a) with Cinema Signal (#2dd4bf) as its vivid counterpart. Those accents appear nowhere else. The sidebar's ambient glow shifts with the active route, making navigation feel like entering a different room.

**Key Characteristics:**
- Dark-first, permanently. No light mode for the app surface.
- Five-stop tonal depth — never a single flat background.
- Nine module accents, each used only within its own section.
- Inter only — weight and size create all hierarchy; no second family.
- Motion: state-driven at 100–250ms, never decorative.
- Scrollbars: 4px, barely visible, thinning to transparent on track.

---

## 2. Colors: The Depth Spectrum

The palette is not a dark theme — it is a depth system. Black is the foundation; each surface stop is a subtle step toward the light, creating a precise vertical hierarchy. Color belongs to modules; neutrals belong to the structure.

### Neutral — Surfaces

- **Abyss** (#09090b): The application background. Body, outer shell, the deepest layer.
- **Night Raise** (#0e0e10): Cards at rest, sidebar background. The first lifted surface.
- **Charcoal Step** (#141416): Hover state for cards and nav items. Active sidebar entries.
- **Studio Dark** (#1a1a1d): Popovers, dropdowns. Three steps above the floor.
- **Control Surface** (#1f1f22): Inputs, modals, inline forms. The topmost layer before content.

### Neutral — Ink

- **Primary Ink** (#e2e2e6): All titles, labels, main content. Never pure white — slightly blue-shifted for eye comfort on dark surfaces.
- **Secondary Ink** (#a0a0a8): Descriptions, supporting text, timestamps.
- **Tertiary Ink** (#71717a): Inactive nav items, placeholders, metadata. Meets WCAG AA (4.8:1 on Abyss).
- **Disabled Ink** (#3d3d44): Non-interactive text. Below contrast threshold by design.

### Neutral — Borders

- **Border Subtle** (#ffffff0a): Card edges, structural dividers. Nearly invisible — presence without interruption.
- **Border Default** (#ffffff12): Standard component borders (inputs, dropdowns).
- **Border Strong** (#ffffff1c): Emphasized dividers, section separators.
- **Border Focus** (#ffffff33): Focus rings on interactive elements.

### Module Accents

Each accent is used exclusively within its module scope. Using Goals' Emerald Drive in the Tasks module is a violation.

- **Control Blue** (#60a5fa) — Dashboard: overview indicators, active metric highlights.
- **Emerald Drive** (#22c55e) — Goals: progress bars, active goal indicators, milestones.
- **Vital Rose** (#f43f5e) — Habits: completion rings, streak indicators.
- **Amber Chronicle** (#f97316) — Journal: entry markers, date highlights.
- **Zinc Focus** (#71717a) — Tasks: a deliberate non-color. Task work is neutral; color belongs to priority and status, not the module itself.
- **Cinema Depth** (#0c3d4a) — Watching, solid surfaces: buttons, My Record background, episode badge fill.
- **Cinema Signal** (#2dd4bf) — Watching, vivid: tab underlines, progress bars, active indicators, dock icon. Never used as a background at full opacity.
- **Emerald Field** (#10b981) — Sports: match indicators, competition highlights.
- **Sky Shelf** (#0ea5e9) — Books: reading progress, shelf markers.

### Semantic

- **Error** (#f87171): Overdue dates, delete actions, critical warnings.
- **Warning** (#f59e0b): Deadlines within 3 days, staleness alerts (7–14 days).
- **Success** (#4ade80): Completed states, milestone achieved.

### Named Rules

**The Module Sovereignty Rule.** Each accent color belongs to one module and only that module. If an accent appears outside its module's scope, one instance is wrong. This is non-negotiable.

**The Depth Gradient Rule.** No two adjacent surfaces may share the same stop. Cards sit on surface-base, modal content sits in surface-input, popovers use surface-overlay. The stack is always visible.

---

## 3. Typography: The Single Voice

**Body Font:** Inter (loaded via `next/font/google`, variable `--font-sans`)
**No display font. No mono font.** One family. All hierarchy through weight and scale.

Inter was chosen for its neutrality at small sizes, generous x-height at 12–14px, and the way its medium weight (500) reads as "active" without feeling heavy. Weight contrast — 500 body, 600 semibold, 700 bold — is the only typographic decoration HEGON allows.

### Hierarchy

- **Title** (700, 15px, -0.01em letter-spacing, 1.2 line-height): Section headings within a module ("In Progress", "Your Tasks"), page-level labels. Used sparingly.
- **Body** (500, 14px, normal, 1.5): Card content, descriptions, modal form labels. The everyday reading size.
- **Label** (500, 12px, normal, 1.3): Metadata inside cards — tags, due dates, episode badges, chip text.
- **Caption** (600, 10px, 0.08em letter-spacing, 1.2): Nav group labels ("LIFE", "PERSO", "PRO"), section eyebrows when used as a system element. Uppercase only at this size and only for structural nav labels — never for body copy.
- **Numeric emphasis** (700, 13–14px): Isolated numbers that need to read as data — progress percentages, counts, ratings.

### Named Rules

**The Single Voice Rule.** One font family. Period. No display font for heroes, no mono for code. If a second family appears, remove it. Weight contrast creates hierarchy; a second family creates noise.

**The No-Fluid Rule.** Sizes are fixed in px, never `clamp()`. HEGON is always viewed at a desk at consistent DPI. Fluid scaling that responds to viewport width makes sidebar headings shrink — that is worse, not better.

---

## 4. Elevation: Tonal Depth

HEGON uses no shadows. Depth is conveyed entirely through the five-stop surface scale. No `box-shadow`, no `drop-shadow`, no `filter: blur` — these are prohibited on standard UI surfaces.

The rule is simple: each surface stop reads as one level closer to the user. The Abyss (#09090b) is the floor. Cards float at Night Raise. Modals and popovers live at Studio Dark or Control Surface. The user always knows which layer they are on because every layer is a distinct color.

The sole exception is the ambient glow in the sidebar: a radial gradient from the active module's accent color at 22% opacity, positioned at the top of the sidebar. This is not a shadow — it is the module's atmosphere bleeding into the navigation.

### Named Rules

**The No-Shadow Rule.** Shadows are prohibited on all standard UI components: cards, buttons, inputs, nav items, modals. The surface scale provides all the depth the interface needs. A card with a box-shadow on top of #0e0e10 looks like a wrong UI choice; a card on #09090b without a shadow looks correct.

**The Atmosphere Exception.** The sidebar's radial ambient glow (active module accent at 8–22% opacity) is the only permitted "elevation effect" outside the surface scale. It communicates context, not layer height.

---

## 5. Components

### Buttons

Two variants only. Primary and ghost. No secondary, no outline-on-tinted-surface.

- **Shape:** Gently rounded (8px, `{rounded.lg}`) for primary; pill shape (9999px, `{rounded.full}`) for ghost/icon buttons.
- **Primary:** Module accent as background (e.g., Cinema Depth #0c3d4a for Watching), white text, 6px × 12px padding. The accent is always the active module's accent — button-primary in Goals uses Emerald Drive, not Cinema Depth.
- **Ghost:** Transparent at rest; white/10% fill on hover. Circular for icon-only nav controls (prev/next chevrons). Rectangular ghost (`{rounded.lg}`) for text labels in dropdowns.
- **Press feedback:** `active:scale(0.97)` on all interactive elements — buttons, nav items, cards. At 97%, not 95%.
- **Transition:** `transition-[background-color,opacity,transform] 150ms ease-out`. Never `transition-all`.
- **Disabled:** `opacity: 0.3`, `cursor: not-allowed`. No color shift.

### Cards

Cards are the primary content surface across all modules.

- **Corner Style:** Gently rounded (12px, `{rounded.xl}`) for content cards; moderately rounded (8px, `{rounded.lg}`) for list rows.
- **Background:** Night Raise (#0e0e10) at rest; Charcoal Step (#141416) on hover.
- **Shadow Strategy:** None. See Elevation.
- **Border:** Border Subtle (#ffffff0a) — 1px, near-invisible.
- **Internal Padding:** 12px standard; 16px for media cards (more visual content).
- **Hover transition:** `transition-colors 100ms ease`. Fast, not animated — state change, not choreography.
- **Stagger entrance:** When a list of cards loads, each card entrance is staggered at 40ms delay with a `y: 8px → 0` + `opacity: 0 → 1` animation over 250ms using `cubic-bezier(0.23, 1, 0.32, 1)`.

### Inputs / Fields

- **Style:** Control Surface (#1f1f22) background, Border Default (#ffffff12) border, 6px radius.
- **Focus:** Border shifts to Border Focus (#ffffff33). No glow, no color accent — focus is structural, not module-tinted.
- **Placeholder:** Tertiary Ink (#71717a).
- **Error:** Border shifts to Semantic Error (#f87171). No background change.
- **Disabled:** Opacity 0.5 on the entire field.

### Navigation — Sidebar

The sidebar is HEGON's most distinctive component. It is not a list of links — it is a reactive environment.

- **Width:** 210px expanded, 60px collapsed. Animated via Framer Motion (`tween`, 180ms, ease-[0.4,0,0.2,1]`).
- **Ambient glow:** Radial gradient from the active module's accent at the top of the sidebar, transitioning over 700ms when the section changes. Each route owns its atmosphere.
- **Nav items:** 13px, 500 weight, Tertiary Ink at rest. On active: Primary Ink, white/7% background, accent-colored icon, accent-colored 4px×12px pill indicator at right edge.
- **Group labels:** 10px, 600 weight, uppercase, 0.08em tracking, Tertiary Ink. Collapsed: replaced by a horizontal divider.
- **Collapsed mode:** Icons only (15px Lucide), centered, Tooltip on hover (Charcoal bg, 12px, 180ms ease). The tooltip appears at the icon's vertical midpoint.
- **Footer profile row:** Avatar (violet-to-indigo gradient, 28px circle), workspace name in Tertiary Ink. Opens a floating ProfileMenu anchored to the row's position via `getBoundingClientRect`.

### Module Accent Chip (Signature Component)

Used in Watching carousels to show episode progress. A pill-shaped badge that uses `color-mix(in srgb, accent 40%, transparent)` as its background and the vivid accent as its text color.

- **Shape:** Full pill (9999px radius).
- **Background:** `color-mix(in srgb, var(--color-accent-watching) 40%, transparent)`.
- **Text:** Cinema Signal (#2dd4bf), 10px, 600 weight.
- **Usage:** Episode badges (S01 E05), priority indicators in Want to Watch, any module-specific micro-label.

---

## 6. Do's and Don'ts

### Do:

- **Do** use the five surface stops in sequence. Cards on `surface-raised`, inputs on `surface-input`, popovers on `surface-overlay`. Never skip stops or use the same stop twice in a stack.
- **Do** apply module accents exclusively within their module. Emerald Drive (#22c55e) in Goals, never in Tasks or Watching.
- **Do** use `transition-[background-color,opacity,transform] 150ms ease-out` on all interactive elements. Specify exact properties — never `transition-all`.
- **Do** add `active:scale(0.97)` press feedback to every button, card, and nav item. The interface should feel physical.
- **Do** stagger card list entrances at 40ms per item with `cubic-bezier(0.23, 1, 0.32, 1)`. Stagger one list at a time — never stagger across multiple independent sections simultaneously.
- **Do** maintain WCAG AA: 4.5:1 for body text, 3:1 for large text. Tertiary Ink (#71717a) on Abyss (#09090b) passes at 4.8:1. Disabled Ink (#3d3d44) intentionally fails — it signals non-interactivity.
- **Do** respect `prefers-reduced-motion`. All animations must have a `duration: 0.01ms` fallback via the global `@media (prefers-reduced-motion: reduce)` rule already in `globals.css`.

### Don't:

- **Don't** use a flat single background. HEGON "Depth over flatness" is the second design principle. A screen where every surface is #09090b has failed.
- **Don't** copy Vercel's design. Vercel is explicitly on the anti-reference list: too black/white, no color personality, sterile. HEGON has nine accent colors — use them.
- **Don't** apply generic SaaS dark mode patterns: flat zinc everywhere, same card grid repeated, no visual identity between sections. These are banned by PRODUCT.md.
- **Don't** use gradient text (`background-clip: text` + gradient). Any emphasis belongs to weight or size, not decoration.
- **Don't** use glassmorphism as a default surface treatment. The Tasks sidebar uses `backdrop-blur-xl` as a purposeful exception tied to a specific `isGlass` flag. Every other surface uses the tonal scale.
- **Don't** add identical card grids. HEGON modules use different layouts: Watching uses carousels, Goals uses a progress-first list, Tasks uses a Kanban board. Homogenizing to "cards in a grid" destroys module identity.
- **Don't** add a second font family. If you are tempted to add a display font for heroes or a mono font for data, the answer is Inter in 700 weight. The Single Voice Rule is absolute.
- **Don't** use `transition-all`. Specify the exact CSS properties being transitioned. `transition-all` animates layout properties and causes subtle jank.
- **Don't** add `box-shadow` to standard UI components. The No-Shadow Rule is absolute for cards, buttons, inputs, and nav items.
- **Don't** use module accent colors as backgrounds at full opacity outside their designated role. Cinema Depth (#0c3d4a) is a valid button background in Watching. Emerald Drive (#22c55e) as a card background anywhere is wrong.
- **Don't** use AI-interface patterns: cream backgrounds, hero-metric templates (big number + small label + gradient accent), numbered section markers (01 / 02 / 03), or tiny uppercase tracked eyebrows above every section. These are banned in PRODUCT.md.
